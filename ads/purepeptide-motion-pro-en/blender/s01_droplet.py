"""S01 "A droplet of light" f0–f126 (rendered f30–f126): its own Cycles scene, no phone (SHOTS S01, BRIEF §3.1/§3.3).
Black brushed-steel bench at z = 0, the word "pure" (assets/type/pure_4k.png) as screen-printed ink (colour mask +
0.08 mm bump displacement, 52 mm wide, centred, reading along +X), a 7 mm water drop (Glass IOR 1.333) on the "u",
a cold rim strip (HIT1 f30), a travelling top strip (f36–f72), the key fading up f89–f117, two bulb spots.
Camera 100 mm f/2.8, 28° down, 0.32 → 0.26 m, roll 0 → 2.5°, focus on the drop then racking to the "p" f96–f117.

usage: PY blender/s01_droplet.py [--range 30-126] [--pct 100] [--samples 32] [--preview] [--force]
outputs: renders/3d/s01/beauty/####.png (RGB, opaque, black world), log.json
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as C  # noqa: E402
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Quaternion, Vector  # noqa: E402

MM = 0.001
F0, F1 = 30, 126
WORD_W = 0.052                       # printed word width (m)
DROP = Vector((-0.006, 0.0, 0.0))    # the drop's contact centre: on the "u"
DROP_R, DROP_Z0, FILLET = 3.5, 0.4, 0.2   # mm: sphere radius, centre height above the bench, meniscus fillet
P_OF_PURE = Vector((-0.019, 0.0, 0.0))   # the "p" (rack-focus target)
ELEV = 28.0                               # camera elevation (deg down)
RIM_W, TOP_W, KEY_W = 2.0, 0.15, 4.0           # W (BRIEF's 18 / 8 / 6 blow out the metal: a mirror of a 2 m strip at 18 W is 14 W/sr/m²)
RIM_LOC = (0.15, 0.20, 0.70)                  # behind-right, high: 40° off the steel's mirror path (at z 0.12 the whole bench went grey: measured)
RIM_SIZE = (2.00, 0.05)                       # long, thin: a crisp arc on the drop; a 0.20 m strip reflected 1:1 in the steel is a 60 %-frame band
TOP_SIZE = (0.01, 1.50)                        # 1 cm wide: its mirror image on the steel is a ~70 px line (0.10 m = the whole frame, measured)
TOP_LOC_YZ = (0.40, 0.25)                     # the travelling strip sits ON the camera's mirror path (28° behind) so its line is seen on the steel


# ----------------------------------------------------------------------------- helpers
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    return m, nt, out


def area(scene, name, loc, size, size_y, energy, color=(1, 1, 1), target=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = size, size_y
    ld.energy = energy
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    if target is not None:
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    ob.visible_camera = False
    return ob


def point(scene, name, loc, energy, radius=0.025):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = energy
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    ob.visible_camera = False
    return ob


def lathe(name, profile, steps=96):
    """revolve an (r, z) profile (mm, from the top pole down to the axis at the bottom) around Z → mesh."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, z * MM))])
        else:
            rings.append([bm.verts.new((r * MM * math.cos(2 * math.pi * k / steps), r * MM * math.sin(2 * math.pi * k / steps), z * MM))
                          for k in range(steps)])
    for a, b in zip(rings, rings[1:]):
        for k in range(steps):
            va = a[k % len(a)]
            va2 = a[(k + 1) % len(a)]
            vb = b[k % len(b)]
            vb2 = b[(k + 1) % len(b)]
            vs = [v for v in (va, va2, vb2, vb)]
            uniq = []
            for v in vs:
                if v not in uniq:
                    uniq.append(v)
            if len(uniq) >= 3:
                try:
                    bm.faces.new(uniq)
                except ValueError:
                    pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    return ob


def drop_profile():
    """sphere R=3.5 mm, centre 0.4 mm above the bench, cut by z=0, with a 0.2 mm concave meniscus fillet to the bench."""
    R, z0, fr = DROP_R, DROP_Z0, FILLET
    # fillet centre: at height fr, tangent to the sphere from outside → distance R + fr from the sphere centre
    cx = math.sqrt((R + fr) ** 2 - (z0 - fr) ** 2)
    cz = fr
    # tangent point on the sphere: along the line sphere-centre → fillet-centre at radius R
    ang_t = math.atan2(cz - z0, cx)            # angle of that direction (from +r axis, towards +z)
    prof = []
    n_sph = 40
    for i in range(n_sph + 1):
        a = math.pi / 2 - (math.pi / 2 - ang_t) * i / n_sph       # from the top pole (90°) down to ang_t
        prof.append((R * math.cos(a), z0 + R * math.sin(a)))
    # fillet arc: around (cx, cz), from the tangent point (direction towards the sphere centre) down to (cx, 0)
    a0 = math.atan2(z0 - cz, 0 - cx)            # from the fillet centre towards the sphere centre
    a1 = -math.pi / 2                           # straight down → touches the bench tangentially
    if a0 > 0:
        a0 -= 2 * math.pi
    for i in range(1, 9):
        a = a0 + (a1 - a0) * i / 8
        prof.append((cx + fr * math.cos(a), max(0.0, cz + fr * math.sin(a))))
    prof.append((cx + 0.0, -0.02))              # a hair below the bench (never hit: the steel is above it)
    prof.append((0.0, -0.02))                   # bottom pole
    return prof


# ----------------------------------------------------------------------------- scene
def build(denoise=True, samples=32):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = 'S01'
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    # --- render settings (the phone scene's family, film opaque)
    r = scene.render
    r.engine = 'CYCLES'
    r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
    r.fps = 30
    r.film_transparent = False
    r.use_persistent_data = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGB'
    r.image_settings.color_depth = '8'
    r.use_motion_blur = True
    r.motion_blur_shutter = 0.5
    r.threads_mode = 'FIXED'
    r.threads = 4
    c = scene.cycles
    c.device = 'CPU'
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.adaptive_min_samples = 8
    c.use_denoising = denoise
    c.denoiser = 'OPENIMAGEDENOISE'
    c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    c.denoising_prefilter = 'ACCURATE'
    c.denoising_quality = 'BALANCED'
    c.max_bounces = 8
    c.diffuse_bounces = 2
    c.glossy_bounces = 3
    c.transmission_bounces = 6
    c.transparent_max_bounces = 12
    c.volume_bounces = 0
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_direct = 0.0
    c.sample_clamp_indirect = 4.0
    c.blur_glossy = 0.5
    c.filter_width = 1.0
    c.seed = 11
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.display_settings.display_device = 'sRGB'
    scene.frame_start, scene.frame_end = F0, F1
    # --- world: black
    world = bpy.data.worlds.new('Void')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0, 0, 0, 1)
    bg.inputs['Strength'].default_value = 0.0
    scene.world = world

    # --- bench: black brushed steel + screen-printed "pure"
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    S = 0.30
    vs = [bm.verts.new(v) for v in ((-S, -S, 0), (S, -S, 0), (S, S, 0), (-S, S, 0))]
    f = bm.faces.new(vs)
    for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = uv
    me = bpy.data.meshes.new('Bench')
    bm.to_mesh(me)
    bm.free()
    bench = bpy.data.objects.new('Bench', me)
    scene.collection.objects.link(bench)
    m, nt, out = new_mat('BrushedSteel')
    obj = nt.nodes.new('ShaderNodeTexCoord')
    # roughness breakup
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 40.0
    nz.inputs['Detail'].default_value = 2.0
    nt.links.new(obj.outputs['Object'], nz.inputs['Vector'])
    rough = nt.nodes.new('ShaderNodeMapRange')
    rough.inputs['From Min'].default_value = 0.0
    rough.inputs['From Max'].default_value = 1.0
    rough.inputs['To Min'].default_value = 0.31
    rough.inputs['To Max'].default_value = 0.37
    nt.links.new(nz.outputs['Fac'], rough.inputs['Value'])
    # brush bump: wave bands varying along Y (streaks along X), 400/m, distortion 2, 0.02 mm
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Y'
    wave.inputs['Scale'].default_value = 1500.0       # 0.67 mm lines (400/m = 2.5 mm reads as moiré stripes at 30 px/mm)
    wave.inputs['Distortion'].default_value = 3.0
    wave.inputs['Detail'].default_value = 3.0
    wave.inputs['Detail Scale'].default_value = 2.0
    nt.links.new(obj.outputs['Object'], wave.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 1.0
    bump.inputs['Distance'].default_value = 0.004 * MM
    nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
    steel = nt.nodes.new('ShaderNodeBsdfPrincipled')
    steel.inputs['Base Color'].default_value = (0.11, 0.115, 0.125, 1)
    steel.inputs['Metallic'].default_value = 1.0
    steel.inputs['Anisotropic'].default_value = 0.75
    steel.inputs['Anisotropic Rotation'].default_value = 0.0
    nt.links.new(rough.outputs['Result'], steel.inputs['Roughness'])
    nt.links.new(bump.outputs['Normal'], steel.inputs['Normal'])
    tangent = nt.nodes.new('ShaderNodeTangent')
    tangent.direction_type = 'UV_MAP'
    nt.links.new(tangent.outputs['Tangent'], steel.inputs['Tangent'])
    # the ink mask: pure_4k.png mapped to a 52 mm wide box centred on the origin
    png = os.path.join(C.TYPE, 'pure_4k.png')
    from PIL import Image
    iw, ih = Image.open(png).size
    word_h = WORD_W * ih / iw
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(obj.outputs['Object'], sep.inputs['Vector'])
    u = nt.nodes.new('ShaderNodeMath')
    u.operation = 'MULTIPLY_ADD'
    u.inputs[1].default_value = 1.0 / WORD_W
    u.inputs[2].default_value = 0.5
    nt.links.new(sep.outputs['X'], u.inputs[0])
    v = nt.nodes.new('ShaderNodeMath')
    v.operation = 'MULTIPLY_ADD'
    v.inputs[1].default_value = 1.0 / word_h
    v.inputs[2].default_value = 0.5
    nt.links.new(sep.outputs['Y'], v.inputs[0])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(u.outputs[0], comb.inputs['X'])
    nt.links.new(v.outputs[0], comb.inputs['Y'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(png, check_existing=True)
    tex.image.colorspace_settings.name = 'sRGB'
    tex.extension = 'CLIP'
    tex.interpolation = 'Cubic'
    nt.links.new(comb.outputs['Vector'], tex.inputs['Vector'])
    ink = nt.nodes.new('ShaderNodeBsdfPrincipled')
    ink.inputs['Base Color'].default_value = (0.93, 0.95, 0.97, 1)
    ink.inputs['Roughness'].default_value = 0.55
    ink.inputs['Specular IOR Level'].default_value = 0.3
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
    nt.links.new(steel.outputs[0], mix.inputs[1])
    nt.links.new(ink.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    disp = nt.nodes.new('ShaderNodeDisplacement')
    disp.inputs['Midlevel'].default_value = 0.0
    disp.inputs['Scale'].default_value = 0.08 * MM
    nt.links.new(tex.outputs['Alpha'], disp.inputs['Height'])
    nt.links.new(disp.outputs['Displacement'], out.inputs['Displacement'])
    m.displacement_method = 'BUMP'
    me.materials.append(m)

    # --- the water drop
    drop = lathe('Drop', drop_profile())
    scene.collection.objects.link(drop)
    drop.location = DROP
    mw, nt, out = new_mat('Water')
    g = nt.nodes.new('ShaderNodeBsdfGlass')
    g.inputs['IOR'].default_value = 1.333
    g.inputs['Roughness'].default_value = 0.0
    nt.links.new(g.outputs[0], out.inputs['Surface'])
    drop.data.materials.append(mw)

    # --- lights
    dc = DROP + Vector((0, 0, 2 * MM))
    rim = area(scene, 'Rim', RIM_LOC, RIM_SIZE[0], RIM_SIZE[1], 0.0, color=(0.86, 0.92, 1.0), target=dc)   # RIM_W = 3× key in *radiance terms* would blow the near-mirror steel: 18 W → white frame (measured); 3 W keeps the steel black
    top = area(scene, 'TopStrip', (0.0, TOP_LOC_YZ[0], TOP_LOC_YZ[1]), TOP_SIZE[0], TOP_SIZE[1], TOP_W, target=(0, 0, 0))
    top.location.x = -0.30     # points straight down, slides along X
    key = area(scene, 'Key', (-0.45, -0.30, 0.40), 0.90, 0.60, 0.0, color=(0.90, 0.94, 1.0), target=(0, 0, 0))
    point(scene, 'Bulb1', (0.08, -0.05, 0.15), 0.1)
    point(scene, 'Bulb2', (-0.10, 0.04, 0.12), 0.1)
    # keys: rim 0 → 18 W f30–f33 (HIT1); top x −0.30 → +0.30 f36–f72; key 0 → 6 W f89–f117
    for f, w in ((0, 0.0), (F0, 0.0), (33, RIM_W)):
        rim.data.energy = w
        rim.data.keyframe_insert('energy', frame=f)
    for f in range(36, 73):
        top.location.x = -0.30 + 0.60 * C.bez((f - 36) / 36.0)
        top.keyframe_insert('location', index=0, frame=f)
    top.location.x = -0.30
    top.keyframe_insert('location', index=0, frame=0)
    for f in range(89, 118):
        key.data.energy = KEY_W * C.bez((f - 89) / 28.0)
        key.data.keyframe_insert('energy', frame=f)
    key.data.energy = 0.0
    key.data.keyframe_insert('energy', frame=0)

    # --- camera: 100 mm, 28° down, aimed at the drop, 0.32 → 0.26 m, roll 0 → 2.5°; DOF f/2.8 7 blades 12°
    cd = bpy.data.cameras.new('Camera')
    cd.lens = 100.0
    cd.sensor_width = 36.0
    cd.sensor_fit = 'HORIZONTAL'
    cd.clip_start = 0.01
    cd.clip_end = 10.0
    cam = bpy.data.objects.new('Camera', cd)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.rotation_mode = 'QUATERNION'
    focus = bpy.data.objects.new('Focus', None)
    scene.collection.objects.link(focus)
    cd.dof.use_dof = True
    cd.dof.focus_object = focus
    cd.dof.aperture_fstop = 2.8
    cd.dof.aperture_blades = 7
    cd.dof.aperture_rotation = math.radians(12)
    el = math.radians(ELEV)
    back = Vector((0.0, -math.cos(el), math.sin(el)))
    for f in range(0, F1 + 1):
        t = C.bez(max(0.0, (f - F0)) / (F1 - F0))
        d = 0.32 + (0.26 - 0.32) * t
        roll = math.radians(2.5 * t)
        pos = dc + back * d
        fwd = (dc - pos).normalized()
        q = fwd.to_track_quat('-Z', 'Y') @ Quaternion((0, 0, 1), roll)
        cam.location = pos
        cam.rotation_quaternion = q
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_quaternion', frame=f)
        # focus: the drop's front surface to f96, rack to the "p" f96–f117 (sine in-out), hold
        front = dc + (pos - dc).normalized() * (DROP_R * MM)
        if f <= 96:
            fp = front
        elif f >= 117:
            fp = P_OF_PURE
        else:
            e = C.sine_inout((f - 96) / 21.0)
            fp = front.lerp(P_OF_PURE, e)
        focus.location = fp
        focus.keyframe_insert('location', frame=f)
    scene.frame_set(F0)
    return scene


def main():
    ap = C.cli('S01 droplet', default_range='%d-%d' % (F0, F1))
    args = C.apply_preview(ap.parse_args())
    C.lock()
    scene = build(denoise=not args.no_denoise, samples=args.samples or 32)
    outdir = C.outdir_for('s01', args)
    if args.exec:
        exec(args.exec, {'bpy': bpy, 'scene': scene, 'C': C})
    frames = C.parse_range(args.range)
    C.render(scene, None, frames, args.pct, args.samples or 32, False, outdir, force=args.force,
             denoise=not args.no_denoise)


if __name__ == '__main__':
    main()
