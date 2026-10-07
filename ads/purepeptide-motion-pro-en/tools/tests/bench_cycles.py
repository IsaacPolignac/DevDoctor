"""T1: Cycles CPU cost per frame for the 3D phone shots (FACTS for TECH.md).

usage: <blender-venv>/bin/python tools/tests/bench_cycles.py [--quick]

One Blender process, renders run one after another (never two Blenders at once), each kept under ~3 min.
Scenes (phone in the hero_34 pose, screen = clean/screen_cart.png):
  phone      : the phone alone, film_transparent, full frame (no border crop)
  phone_bord : the phone alone with the production border crop (render_iphone.set_border)
  glass      : phone + 3 glass spheres + glossy floor plane + camera DOF (f/2.8)
  fog        : phone + volumetric fog box (Principled Volume) around the phone
Resolutions 1920x1080 and 1280x720; samples 16 (+OIDN) and 48 (+OIDN), plus one 48-no-denoise run to isolate OIDN.
Adaptive sampling stays as in production (threshold 0.02, min 8). Output: tools/tests/out/bench/*.png + bench.json.
"""
import json
import math
import os
import sys
import time

import bpy  # noqa: must be imported before bmesh/mathutils
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PRO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(PRO, 'assets', 'iphone', 'tools'))
import render_iphone as R  # noqa: E402

OUT = os.path.join(HERE, 'out', 'bench')
os.makedirs(OUT, exist_ok=True)
QUICK = '--quick' in sys.argv
LOG = os.path.join(OUT, 'bench.json')
results = []


def loadavg():
    return float(open('/proc/loadavg').read().split()[0])


def mesh_obj(name, bm, mat=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    return ob


def principled(name, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    for k, v in kw.items():
        b.inputs[k.replace('_', ' ')].default_value = v
    return m, b


def add_glass_floor_dof(scene):
    m_floor, _ = principled('BenchFloor', Base_Color=(0.045, 0.055, 0.075, 1), Roughness=0.12, Metallic=0.0)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.5)
    floor = mesh_obj('BenchFloor', bm, m_floor)
    floor.location = (0, 0.05, -0.086)
    m_glass, b = principled('BenchGlass', Base_Color=(1, 1, 1, 1), Roughness=0.02, IOR=1.5)
    b.inputs['Transmission Weight'].default_value = 1.0
    for i, (x, y, r) in enumerate(((-0.095, -0.06, 0.024), (0.085, -0.09, 0.017), (0.115, 0.05, 0.031))):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=r)
        for f in bm.faces:
            f.smooth = True
        sp = mesh_obj('BenchSphere%d' % i, bm, m_glass)
        sp.location = (x, y, -0.086 + r)
    c = scene.cycles
    c.transmission_bounces = 8
    c.max_bounces = 12
    c.caustics_reflective = False
    c.caustics_refractive = False
    cam = scene.camera
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = (Vector(cam.location) - bpy.data.objects['iPhone'].location).length
    cam.data.dof.aperture_fstop = 2.8
    cam.data.dof.aperture_blades = 0


def add_fog(scene):
    m = bpy.data.materials.new('BenchFog')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.82, 0.87, 0.95, 1)
    vol.inputs['Density'].default_value = 1.6      # per metre: ~55 % transmittance over the 0.5 m box
    vol.inputs['Anisotropy'].default_value = 0.35
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    box = mesh_obj('BenchFogBox', bm, m)
    box.scale = (0.9, 0.5, 0.6)
    box.location = (0, 0.05, 0)
    scene.cycles.volume_bounces = 0
    scene.cycles.volume_step_rate = 1.0
    scene.cycles.volume_max_steps = 512


def remove_extras():
    for o in list(bpy.data.objects):
        if o.name.startswith('Bench'):
            bpy.data.objects.remove(o, do_unlink=True)
    cam = bpy.context.scene.camera
    cam.data.dof.use_dof = False


def run(scene, root, tag, res, samples, denoise, border=False):
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = res[0], res[1], 100
    r.use_border = False
    r.use_motion_blur = False
    if border:
        R.set_border(scene, root)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = denoise
    name = '%s_%dp_s%d%s%s' % (tag, res[1], samples, '' if denoise else '_nodenoise', '_border' if border else '')
    la = loadavg()
    dt = R.render_to(scene, os.path.join(OUT, name + '.png'))
    rec = {'name': name, 'scene': tag, 'res': '%dx%d' % res, 'samples': samples, 'oidn': denoise, 'border': border,
           'seconds': round(dt, 2), 'loadavg_before': la}
    results.append(rec)
    json.dump({'blender': bpy.app.version_string, 'threads': r.threads, 'adaptive': scene.cycles.use_adaptive_sampling,
               'adaptive_threshold': scene.cycles.adaptive_threshold, 'results': results}, open(LOG, 'w'), indent=1)
    print('BENCH %-34s %7.2f s  (load %.2f)' % (name, dt, la), flush=True)
    return dt


def main():
    scene, root = R.load()
    R.set_screen(os.path.join(PRO, 'assets', 'site', 'clean', 'screen_cart.png'))
    loc, q = R.pose('hero_34', 1.0)
    R.set_pose(root, loc, q)
    bpy.context.view_layer.update()
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    RES = [(1280, 720), (1920, 1080)]
    SMP = [16, 48]
    if QUICK:
        RES, SMP = [(1280, 720)], [16]
    # --- phone alone (+ production border crop as extra points)
    for res in RES:
        for s in SMP:
            run(scene, root, 'phone', res, s, True)
    run(scene, root, 'phone', (1920, 1080), 48, False)             # isolates the OIDN cost
    for s in SMP:
        run(scene, root, 'phone', (1920, 1080), s, True, border=True)
    # --- glass spheres + glossy floor + DOF
    add_glass_floor_dof(scene)
    for res in RES:
        for s in SMP:
            run(scene, root, 'glass', res, s, True)
    remove_extras()
    # --- volumetric fog (guard: skip a 48-sample run that would exceed ~3 min)
    add_fog(scene)
    for res in RES:
        t16 = run(scene, root, 'fog', res, 16, True)
        if 48 in SMP:
            if t16 * 3.0 < 170:
                run(scene, root, 'fog', res, 48, True)
            else:
                results.append({'name': 'fog_%dp_s48' % res[1], 'scene': 'fog', 'res': '%dx%d' % res, 'samples': 48,
                                'oidn': True, 'border': False, 'seconds': round(t16 * 3.0, 1), 'extrapolated': True})
                print('BENCH fog %dp s48 skipped (would exceed 3 min), extrapolated %.0f s' % (res[1], t16 * 3), flush=True)
    remove_extras()
    print('DONE', json.dumps(results, indent=1), flush=True)


if __name__ == '__main__':
    main()
