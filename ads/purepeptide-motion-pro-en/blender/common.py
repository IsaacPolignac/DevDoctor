"""blender/common.py — shared rig for the 3D shots (SHOTS §0.2). Blender 5.0.1 as a module (PY venv), Cycles CPU.

Imports assets/iphone/tools/render_iphone.py as R (nothing in assets/iphone/ is modified). Scene frame == film frame.
Every shot script: `--range a-b` (absolute film frames, also `a,b,c`) `--pct N` `--samples N` `--no-denoise`
`--pass beauty|shadow` `--force` `--preview` `--exec "python"`. Exit 3 if another Blender holds renders/3d/.lock.
"""
import argparse
import atexit
import glob
import json
import math
import os
import shutil
import sys
import time

import bpy  # noqa: must be imported before bmesh/mathutils
import bmesh  # noqa: E402
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Quaternion, Vector  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, os.path.join(ROOT, 'assets', 'iphone', 'tools'))
import render_iphone as R  # noqa: E402

MM = 0.001
PT_MM = 66.6 / 402.0                     # one screen point in mm on the display (0.1657)
Y_DISPLAY_MM = -4.3                      # the display plane in the phone's local frame (front = -Y)
RENDERS = os.path.join(ROOT, 'renders', '3d')
LOCK = os.path.join(RENDERS, '.lock')
CLEAN = os.path.join(ROOT, 'assets', 'site', 'clean')
TYPE = os.path.join(ROOT, 'assets', 'type')

# poses (spin deg, tilt deg, roll deg, location m) — SHOTS §1
REST = (0.0, 0.0, 0.0, (0.0, 0.0, 0.0))
ARR0 = (200.0, 12.0, 9.0, (0.26, 0.08, 0.03))
CLOSE = (4.0, -3.0, -1.0, (0.000, -0.288, 0.006))
CARDS = (14.0, -5.0, -2.0, (0.012, -0.253, 0.004))
HERO = (26.0, -14.0, -4.0, (0.012, 0.110, 0.010))
EDGE = (90.0, 0.0, 0.0, (-0.0045, 0.084, 0.000))   # x −4.5 mm: puts the EdgeR rim line at x ≈ 960 (at x 0 it sits at 983, measured)

COLD = {'Key': (0.90, 0.94, 1.00), 'EdgeL': (0.86, 0.92, 1.00), 'EdgeR': (0.86, 0.92, 1.00), 'Fill': (0.88, 0.93, 1.00)}
WARM = {'Key': (1.00, 0.96, 0.91), 'EdgeL': (1.00, 0.98, 0.95), 'EdgeR': (1.00, 0.98, 0.95), 'Fill': (0.95, 0.95, 0.98)}
SOFTBOXES = ('SoftL', 'SoftR', 'SoftFR', 'SoftTop', 'SideL', 'SideR')
AREA_LIGHTS = ('Key', 'Fill', 'Back', 'EdgeL', 'EdgeR')

SPEED = {}          # frame -> pose + derivative (deg/s, m/s)   → pose_speed.json
CORNERS = {}        # frame -> display corners px + matrix3d    → corners.json
_FOCUS = None


# ----------------------------------------------------------------------------- cli / lock
def cli(desc, default_range=None):
    ap = argparse.ArgumentParser(description=desc)
    ap.add_argument('--range', default=default_range, help='absolute film frames a-b (or a,b,c)')
    ap.add_argument('--pct', type=int, default=100)
    ap.add_argument('--samples', type=int, default=0)
    ap.add_argument('--no-denoise', action='store_true')
    ap.add_argument('--pass', dest='pass_', default='beauty', choices=['beauty', 'shadow'])
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--preview', action='store_true', help='= --pct 50 --samples 6 --no-denoise, outputs under <id>_prev/')
    ap.add_argument('--out', default='', help='override the output directory')
    ap.add_argument('--exec', default='', help='debug: python run after the scene is built')
    return ap


def parse_range(spec):
    out = []
    for part in str(spec).split(','):
        part = part.strip()
        if not part:
            continue
        if '-' in part:
            a, b = part.split('-')
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return sorted(set(out))


def _pid_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def lock():
    """renders/3d/.lock holds the pid of the Blender that renders; one at a time on this 4-CPU box."""
    os.makedirs(RENDERS, exist_ok=True)
    if os.path.exists(LOCK):
        try:
            pid = int(open(LOCK).read().split()[0])
        except Exception:
            pid = -1
        if pid > 0 and pid != os.getpid() and _pid_alive(pid):
            print('LOCKED: another Blender (pid %d) holds %s' % (pid, LOCK), flush=True)
            sys.exit(3)
    with open(LOCK, 'w') as fh:
        fh.write('%d %s\n' % (os.getpid(), time.strftime('%Y-%m-%d %H:%M:%S')))

    def _rm():
        try:
            if os.path.exists(LOCK) and open(LOCK).read().split()[0] == str(os.getpid()):
                os.remove(LOCK)
        except Exception:
            pass
    atexit.register(_rm)


# ----------------------------------------------------------------------------- eases
def _cubic(a, b, t):
    """cubic bezier coordinate with P0=0, P1=a, P2=b, P3=1."""
    return 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3


def ease_bez(t, x1=0.6, y1=0.0, x2=0.2, y2=1.0):
    """CSS cubic-bezier(x1,y1,x2,y2) evaluated by bisection on x."""
    t = min(max(t, 0.0), 1.0)
    if t <= 0.0 or t >= 1.0:
        return t
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if _cubic(x1, x2, mid) < t:
            lo = mid
        else:
            hi = mid
    return _cubic(y1, y2, (lo + hi) / 2)


def bez(t):
    return ease_bez(t, 0.6, 0.0, 0.2, 1.0)


def sine_inout(t):
    t = min(max(t, 0.0), 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def expo_out(t, k=10.0):
    t = min(max(t, 0.0), 1.0)
    return 1.0 if t >= 1.0 else 1 - 2 ** (-k * t)


def expo_in(t, k=10.0):
    t = min(max(t, 0.0), 1.0)
    return 0.0 if t <= 0.0 else 2 ** (k * (t - 1))


def expo_inout(t):
    t = min(max(t, 0.0), 1.0)
    return expo_in(2 * t) / 2 if t < 0.5 else 0.5 + expo_out(2 * t - 1) / 2


def power3_in(t):
    t = min(max(t, 0.0), 1.0)
    return t ** 3


def power2_in(t):
    t = min(max(t, 0.0), 1.0)
    return t * t


def lerp_pose(P0, P1, e):
    s0, t0, r0, l0 = P0
    s1, t1, r1, l1 = P1
    return (s0 + (s1 - s0) * e, t0 + (t1 - t0) * e, r0 + (r1 - r0) * e,
            tuple(a + (b - a) * e for a, b in zip(l0, l1)))


def add_pose(P, dspin=0.0, dtilt=0.0, droll=0.0, dloc=(0, 0, 0)):
    return (P[0] + dspin, P[1] + dtilt, P[2] + droll, tuple(a + b for a, b in zip(P[3], dloc)))


# ----------------------------------------------------------------------------- scene
def load(frame_start=0, frame_end=0, denoise=True):
    """R.load() + the film's render state (SHOTS §0.2 load())."""
    scene, root = R.load()
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    c = scene.cycles
    c.device = 'CPU'
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.adaptive_min_samples = 8
    c.use_denoising = denoise
    c.denoiser = 'OPENIMAGEDENOISE'
    c.denoising_prefilter = 'ACCURATE'
    c.denoising_quality = 'BALANCED'
    c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    r = scene.render
    r.film_transparent = True
    r.use_persistent_data = True
    r.use_motion_blur = True
    r.motion_blur_shutter = 0.5
    r.motion_blur_position = 'CENTER'
    r.fps = 30
    r.threads_mode = 'FIXED'
    r.threads = 4
    r.use_border = False
    r.use_crop_to_border = False
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '8'
    if frame_end:
        scene.frame_start, scene.frame_end = frame_start, frame_end
    root.rotation_mode = 'QUATERNION'
    root.animation_data_clear()
    for o in R.PHONE_PARTS:
        o.pass_index = 1
    bpy.data.objects['Screen'].pass_index = 3
    bpy.data.objects['GlassScreen'].pass_index = 3
    SPEED.clear()
    CORNERS.clear()
    return scene, root


def set_samples(scene, samples, pct=100, denoise=None):
    scene.cycles.samples = samples
    scene.render.resolution_percentage = pct
    if denoise is not None:
        scene.cycles.use_denoising = denoise


# ----------------------------------------------------------------------------- poses
def key_lq(root, f, loc, quat):
    root.location = Vector(loc)
    root.rotation_mode = 'QUATERNION'
    root.rotation_quaternion = quat
    root.keyframe_insert('location', frame=f)
    root.keyframe_insert('rotation_quaternion', frame=f)


def _record(f, P, loc, quat):
    prev = SPEED.get(f - 1)
    deg_s = m_s = 0.0
    if prev is not None:
        q0 = Quaternion(prev['quat'])
        dq = quat @ q0.inverted()
        deg_s = math.degrees(2 * math.acos(min(1.0, abs(dq.w)))) * 30.0
        m_s = (Vector(loc) - Vector(prev['loc'])).length * 30.0
    SPEED[f] = {'spin': None if P is None else round(P[0], 4), 'tilt': None if P is None else round(P[1], 4),
                'roll': None if P is None else round(P[2], 4), 'loc': [round(v, 6) for v in loc],
                'quat': [round(v, 7) for v in quat], 'deg_s': round(deg_s, 3), 'm_s': round(m_s, 5)}


def pose(root, f, spin, tilt, roll, loc):
    """key root.location + rotation_quaternion (R.compose) at frame f, linear interpolation."""
    q = R.compose(spin, tilt, roll)
    key_lq(root, f, loc, q)
    _record(f, (spin, tilt, roll, loc), loc, q)


def pose_t(root, f, P):
    pose(root, f, *P)


def move(root, f0, f1, P0, P1, ease=bez):
    """key every frame f0..f1 from P0 to P1 with the ease; the derivative goes to pose_speed.json."""
    n = max(1, f1 - f0)
    for f in range(f0, f1 + 1):
        pose_t(root, f, lerp_pose(P0, P1, ease((f - f0) / n)))
    return P1


def drift(root, f0, f1, P, dspin=0.0, dloc=(0, 0, 0), dtilt=0.0, droll=0.0):
    """sine.inOut micro-move from P to P + d over f0..f1 (never static). Returns the end pose."""
    P1 = add_pose(P, dspin, dtilt, droll, dloc)
    return move(root, f0, f1, P, P1, ease=sine_inout)


def hold(root, f0, f1, P):
    pose_t(root, f0, P)
    for f in range(f0 + 1, f1 + 1):
        pose_t(root, f, P)
    return P


def arr_pose(n):
    """the retimed fly-in (SHOTS S07): t = 2n/42 for n <= 11 else (n+12)/42; R.FLY0 replaced by ARR0. n = f - 708."""
    R.FLY0 = (ARR0[0], ARR0[1], ARR0[2], Vector(ARR0[3]))
    t = (2 * n) / 42.0 if n <= 11 else (n + 12) / 42.0
    return R.pose('flyin', min(t, 1.0))


def arr(root, f0=708):
    """keys the arrival f0..f0+30 (n = 0..30; n = 30 → REST exactly); returns the edge-on (glint) frame."""
    best, best_v = None, 9.0
    for n in range(31):
        loc, q = arr_pose(n)
        f = f0 + n
        key_lq(root, f, loc, q)
        _record(f, None, loc, q)
        nrm = q @ Vector((0, -1, 0))                # the screen normal in world
        if abs(nrm.y) < best_v:
            best, best_v = f, abs(nrm.y)
    return best


def fastest_frame(f0, f1):
    fr = [f for f in SPEED if f0 <= f <= f1]
    return max(fr, key=lambda f: SPEED[f]['deg_s'] + 100 * SPEED[f]['m_s']) if fr else None


def write_speed(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as fh:
        json.dump({'note': 'per film frame: pose (spin/tilt/roll deg, loc m, quaternion) and its derivative deg/s, m/s; '
                           'the mixer aligns whoosh peaks to the fastest frame of each move',
                   'frames': {str(k): v for k, v in sorted(SPEED.items())}}, fh)


# ----------------------------------------------------------------------------- lights
def light(name):
    return bpy.data.objects[name]


def energy_key(name, f, W):
    ld = light(name).data
    ld.energy = W
    ld.keyframe_insert('energy', frame=f)


def color_key(name, f, rgb):
    ld = light(name).data
    ld.color = rgb
    ld.keyframe_insert('color', frame=f)


def _peak_socket(name):
    """the unlinked input of the multiply node feeding Emission Strength in M_<name> (or the material <name>)."""
    nt = bpy.data.materials['M_' + name if ('M_' + name) in bpy.data.materials else name].node_tree
    em = [n for n in nt.nodes if n.type == 'EMISSION'][0]
    lk = [l for l in nt.links if l.to_node == em and l.to_socket.name == 'Strength'][0]
    mul = lk.from_node
    for i in (1, 0):
        if not mul.inputs[i].is_linked:
            return nt, mul, i
    raise RuntimeError('no constant input on the peak node of ' + name)


def softbox_peak(name):
    nt, mul, i = _peak_socket(name)
    return mul.inputs[i].default_value


def softbox_peak_key(name, f, v):
    nt, mul, i = _peak_socket(name)
    mul.inputs[i].default_value = v
    nt.keyframe_insert(data_path='nodes["%s"].inputs[%d].default_value' % (mul.name, i), frame=f)


def softtop_x_key(f, x):
    ob = bpy.data.objects['SoftTop']
    ob.location.x = x
    ob.keyframe_insert('location', index=0, frame=f)


def set_cold(f):
    for n, c in COLD.items():
        color_key(n, f, c)


def set_warm(f):
    for n, c in WARM.items():
        color_key(n, f, c)


def thermometer(f0, f1, ease=bez):
    """cold → warm key colours over f0..f1 (BRIEF §3.1), keyed every frame."""
    for f in range(f0, f1 + 1):
        e = ease((f - f0) / max(1, f1 - f0))
        for n in COLD:
            c0, c1 = COLD[n], WARM[n]
            color_key(n, f, tuple(a + (b - a) * e for a, b in zip(c0, c1)))


def slow_show(f0, f1, ease=bez, key_w=6.0, fill_w=2.0):
    """Key and Fill energy 0 → 6.0 / 2.0 W over f0..f1; everything else untouched."""
    for f in range(f0, f1 + 1):
        e = ease((f - f0) / max(1, f1 - f0))
        energy_key('Key', f, key_w * e)
        energy_key('Fill', f, fill_w * e)


def world_strength_key(f, v):
    nt = bpy.context.scene.world.node_tree
    bg = nt.nodes.get('Background')
    if bg is None:
        return
    bg.inputs['Strength'].default_value = v
    nt.keyframe_insert(data_path='nodes["%s"].inputs[1].default_value' % bg.name, frame=f)


def lights_out(f0, f1, ease=bez, side_r=0.0, edge_l=0.0, world=0.0, sheen=0.0):
    """Key Fill Back → 0 W, SoftL SoftR SoftFR SoftTop SideL → 0, SideR → side_r (SHOTS: 50 %; 0 measured for the
    single line), EdgeL → edge_l, the world ramp → world, the SheenCard → sheen, EdgeR kept, over f0..f1. Measured at f1188: with SideR 50 % +
    EdgeL + the world ramp the whole edge-on rail reads 15–20 levels (68 px wide); with all three at 0 only the EdgeR
    rim line remains."""
    base_w = {n: light(n).data.energy for n in ('Key', 'Fill', 'Back', 'EdgeL')}
    base_p = {n: softbox_peak(n) for n in SOFTBOXES}
    bgn = bpy.context.scene.world.node_tree.nodes.get('Background')
    base_world = bgn.inputs['Strength'].default_value if bgn else 1.0
    base_sheen = softbox_peak('SheenCard')
    for f in range(f0, f1 + 1):
        e = ease((f - f0) / max(1, f1 - f0))
        softbox_peak_key('SheenCard', f, base_sheen * (1 - (1 - sheen) * e))     # the rail mirrors the sheen card: 14 levels at f1188
        for n in ('Key', 'Fill', 'Back'):
            energy_key(n, f, base_w[n] * (1 - e))
        energy_key('EdgeL', f, base_w['EdgeL'] * (1 - (1 - edge_l) * e))
        for n in ('SoftL', 'SoftR', 'SoftFR', 'SoftTop', 'SideL'):
            softbox_peak_key(n, f, base_p[n] * (1 - e))
        softbox_peak_key('SideR', f, base_p['SideR'] * (1 - (1 - side_r) * e))
        world_strength_key(f, base_world * (1 - (1 - world) * e))


# ----------------------------------------------------------------------------- screen
def screen(path):
    img = bpy.data.images.load(path, check_existing=True)
    img.source = 'FILE'
    img.colorspace_settings.name = 'sRGB'
    node = bpy.data.materials['Screen'].node_tree.nodes['ScreenImage']
    node.image = img
    print('screen texture:', path, tuple(img.size), flush=True)
    return img


def screen_seq(d, count, offset, pattern='scr_%04d.png'):
    """image SEQUENCE on the screen (TECH §2): file n shows at scene frame n + offset (frame_start = offset + 1)."""
    first = os.path.join(d, pattern % 1)
    img = bpy.data.images.load(first, check_existing=True)
    img.source = 'SEQUENCE'
    img.colorspace_settings.name = 'sRGB'
    node = bpy.data.materials['Screen'].node_tree.nodes['ScreenImage']
    node.image = img
    iu = node.image_user
    iu.frame_duration = count
    iu.frame_start = offset + 1
    iu.frame_offset = 0
    iu.use_auto_refresh = True
    iu.use_cyclic = False
    print('screen SEQUENCE:', d, 'count', count, 'file n <-> scene frame n +', offset, flush=True)
    return img


def screen_emission_key(f, strength):
    nt = bpy.data.materials['Screen'].node_tree
    nt.nodes['ScreenEmission'].inputs['Strength'].default_value = strength
    nt.keyframe_insert(data_path='nodes["ScreenEmission"].inputs[1].default_value', frame=f)


# ----------------------------------------------------------------------------- DOF
def dof(scene, root):
    """a focus Empty parented to iPhone (local y = display − focus_mm); 6 blades, 12°."""
    global _FOCUS
    cam = scene.camera
    emp = bpy.data.objects.get('Focus')
    if emp is None:
        emp = bpy.data.objects.new('Focus', None)
        scene.collection.objects.link(emp)
    emp.empty_display_size = 0.01
    emp.parent = root
    emp.location = (0.0, Y_DISPLAY_MM * MM, 0.0)
    cam.data.dof.focus_object = emp
    cam.data.dof.aperture_blades = 6
    cam.data.dof.aperture_rotation = math.radians(12)
    cam.data.dof.use_dof = False
    _FOCUS = emp
    return emp


def focus_mm(z_mm):
    return z_mm


def dof_key(f, on, fstop=5.6, focus_mm=0.0, focus_xz=(0.0, 0.0)):
    """use_dof (constant keys), aperture_fstop, focus Empty at local (x, −(4.3 + focus_mm) mm, z)."""
    cam = bpy.context.scene.camera
    cam.data.dof.use_dof = bool(on)
    cam.data.dof.keyframe_insert('use_dof', frame=f)
    cam.data.dof.aperture_fstop = fstop
    cam.data.dof.keyframe_insert('aperture_fstop', frame=f)
    if _FOCUS is not None:
        _FOCUS.location = (focus_xz[0] * MM, (Y_DISPLAY_MM - focus_mm) * MM, focus_xz[1] * MM)
        _FOCUS.keyframe_insert('location', frame=f)
    # boolean keys are CONSTANT by default in Blender (no fcurve edit needed in the 5.0 layered actions)


# ----------------------------------------------------------------------------- S02 reflect plane
def reflect_plane(png, E=6.0, loc=(-0.35, -0.30, 0.10), rot=None, width=0.30, target=(0, 0.084, 0), tint=(0.93, 0.96, 1.0),
                  link_to=('GlassScreen',)):
    """an emissive plane seen only by glossy rays: Emission tint × E masked by the PNG alpha (→ Transparent mix).
    rot: Euler radians, or None → faces `target`. link_to: light-linked receivers (only they see it); () = everyone."""
    from PIL import Image
    w, h = Image.open(png).size
    W, H = width, width * h / w
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new(v) for v in ((-W / 2, -H / 2, 0), (W / 2, -H / 2, 0), (W / 2, H / 2, 0), (-W / 2, H / 2, 0))]
    fc = bm.faces.new(vs)
    for lp, uv in zip(fc.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = uv
    me = bpy.data.meshes.new('PureReflect')
    bm.to_mesh(me)
    bm.free()
    m = bpy.data.materials.new('PureReflect')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.name = 'ReflectImage'
    tex.image = bpy.data.images.load(png, check_existing=True)
    tex.image.colorspace_settings.name = 'sRGB'
    tex.extension = 'CLIP'
    tex.interpolation = 'Cubic'
    uvn = nt.nodes.new('ShaderNodeUVMap')
    nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.name = 'ReflectEmission'
    em.inputs['Color'].default_value = tuple(tint) + (1.0,)
    em.inputs['Strength'].default_value = E
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    m.cycles.emission_sampling = 'NONE'
    me.materials.append(m)
    ob = bpy.data.objects.new('PureReflect', me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if rot is None:
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('Z', 'Y').to_euler()
    else:
        ob.rotation_euler = rot
    ob.visible_camera = False
    ob.visible_diffuse = False
    ob.visible_shadow = False
    ob.visible_glossy = True
    ob.visible_transmission = False
    ob.visible_volume_scatter = False
    if link_to:
        coll = bpy.data.collections.new('LL_PureReflect')
        for n in link_to:
            coll.objects.link(bpy.data.objects[n])
        ob.light_linking.receiver_collection = coll
        for cobj in coll.collection_objects:
            cobj.light_linking.link_state = 'INCLUDE'
    return ob


def reflect_E_key(ob, f, E):
    nt = ob.data.materials[0].node_tree
    nt.nodes['ReflectEmission'].inputs['Strength'].default_value = E
    nt.keyframe_insert(data_path='nodes["ReflectEmission"].inputs[1].default_value', frame=f)


def reflect_place(ob, scene, root, f, ghost_xz_mm, dist=0.30, up=None):
    """place the plane so its centre is seen (reflected in the cover glass) at display point (x, z) mm at frame f:
    mirror the camera ray about the glass normal at that point and put the plane `dist` m along the reflected ray.
    Keys location + rotation at f (linear)."""
    scene.frame_set(f)
    bpy.context.view_layer.update()
    M = root.matrix_world
    G = M @ Vector((ghost_xz_mm[0] * MM, Y_DISPLAY_MM * MM, ghost_xz_mm[1] * MM))
    n = (M.to_3x3() @ Vector((0, -1, 0))).normalized()
    cam = scene.camera.matrix_world.translation
    d = (G - cam).normalized()
    r = (d - 2 * d.dot(n) * n).normalized()
    P = G + r * dist
    ob.location = P
    upv = Vector(up) if up is not None else (M.to_3x3() @ Vector((0, 0, 1))).normalized()
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = (-r).to_track_quat('Z', 'Y')
    # align the plane's local Y with the phone's up as seen in the mirror: rotate about Z until Y ∥ upv projected
    z = -r
    y = (upv - upv.dot(z) * z).normalized()
    x = y.cross(z).normalized()
    from mathutils import Matrix
    ob.rotation_quaternion = Matrix((x, y, z)).transposed().to_quaternion()
    ob.keyframe_insert('location', frame=f)
    ob.keyframe_insert('rotation_quaternion', frame=f)
    return P


# ----------------------------------------------------------------------------- slabs (S10)
def _rounded_rect(w, h, r, seg=24):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    out = []
    for p in pts:
        if not out or (abs(p[0] - out[-1][0]) > 1e-9 or abs(p[1] - out[-1][1]) > 1e-9):
            out.append(p)
    if abs(out[0][0] - out[-1][0]) < 1e-9 and abs(out[0][1] - out[-1][1]) < 1e-9:
        out.pop()
    return out


def _slab_front_material(name, img_path):
    m = bpy.data.materials.new('Slab_' + name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(img_path, check_existing=True)
    tex.image.colorspace_settings.name = 'sRGB'
    tex.extension = 'EXTEND'
    tex.interpolation = 'Cubic'
    uv = nt.nodes.new('ShaderNodeUVMap')
    nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    pr = nt.nodes.new('ShaderNodeBsdfPrincipled')
    pr.inputs['Roughness'].default_value = 0.28
    pr.inputs['Coat Weight'].default_value = 0.35
    pr.inputs['Coat Roughness'].default_value = 0.08
    nt.links.new(tex.outputs['Color'], pr.inputs['Base Color'])
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.name = 'SlabMix'
    mix.inputs['Fac'].default_value = 0.30
    nt.links.new(em.outputs[0], mix.inputs[1])
    nt.links.new(pr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    m.cycles.emission_sampling = 'NONE'
    return m


def _slab_edge_material():
    m = bpy.data.materials.get('SlabEdge')
    if m:
        return m
    m = bpy.data.materials.new('SlabEdge')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.85, 0.85, 0.85, 1)
    b.inputs['Roughness'].default_value = 0.6
    b.inputs['Transmission Weight'].default_value = 0.3
    b.inputs['IOR'].default_value = 1.45
    return m


def _slab_back_material():
    m = bpy.data.materials.get('SlabBack')
    if m:
        return m
    m = bpy.data.materials.new('SlabBack')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.5, 0.5, 0.52, 1)
    b.inputs['Roughness'].default_value = 0.5
    return m


def slab_crop(name, capture, rect_pt, outdir):
    """the 6× capture crop (render_screens.cjs --dsf 6 → assets/site/clean/slab6x_<name>.png) or the 3× crop ×2."""
    from PIL import Image
    os.makedirs(outdir, exist_ok=True)
    dst = os.path.join(outdir, 'slab_%s.png' % name)
    for six in (os.path.join(TYPE, 'slab_%s.png' % name), os.path.join(CLEAN, 'slab6x_%s.png' % name)):
        if os.path.exists(six):              # the 6× crops from render_screens.cjs --dsf 6 (another agent's output)
            shutil.copy(six, dst)
            return dst
    x, y, w, h = rect_pt
    src = Image.open(os.path.join(CLEAN, capture + '.png')).convert('RGB')
    crop = src.crop((round(x * 3), round(y * 3), round((x + w) * 3), round((y + h) * 3)))
    crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
    crop.save(dst)
    return dst


def slab(name, capture, rect_pt, radius_pt, screen_pt_centre, root=None, thickness_mm=1.0, bevel_mm=0.35, crop_dir=None):
    """TECH §3 recipe: rounded-rect face → extrude 1 mm → bevel 0.35 mm × 3; parented to iPhone at the display
    (local x = (sx−201)·0.1657 mm, z = (437−sy)·0.1657 mm, y = −4.3 mm), pass_index 2. Size = rect × 0.1657 mm/pt (the
    growth 1.00 → 1.25 is the object scale, slab_key)."""
    root = root or bpy.data.objects['iPhone']
    crop_dir = crop_dir or os.path.join(RENDERS, 'take', 'crops')
    img_path = slab_crop(name, capture, rect_pt, crop_dir)
    x, y, w, h = rect_pt
    W, H = w * PT_MM, h * PT_MM
    rr = min(radius_pt * PT_MM, H / 2 - 1e-6)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    verts = [bm.verts.new((px * MM, py * MM, 0.0)) for px, py in _rounded_rect(W, H, rr)]
    back = bm.faces.new(verts)
    res = bmesh.ops.extrude_face_region(bm, geom=[back])
    new_verts = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=new_verts, vec=(0, 0, thickness_mm * MM))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        if fc.normal.z > 0.9:
            fc.material_index = 0
        elif fc.normal.z < -0.9:
            fc.material_index = 2
        else:
            fc.material_index = 1
        fc.smooth = abs(fc.normal.z) < 0.9
        for lp in fc.loops:
            lp[uvl].uv = ((lp.vert.co.x / MM + W / 2) / W, (lp.vert.co.y / MM + H / 2) / H)
    me = bpy.data.meshes.new('Slab_' + name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(_slab_front_material(name, img_path))
    me.materials.append(_slab_edge_material())
    me.materials.append(_slab_back_material())
    ob = bpy.data.objects.new('Slab_' + name, me)
    bpy.context.scene.collection.objects.link(ob)
    bev = ob.modifiers.new('Bevel', 'BEVEL')
    bev.width = bevel_mm * MM
    bev.segments = 3
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(40)
    ob.parent = root
    sx, sy = screen_pt_centre
    ob.location = ((sx - 201) * PT_MM * MM, Y_DISPLAY_MM * MM, (437 - sy) * PT_MM * MM)
    ob.rotation_euler = (math.radians(90), 0.0, 0.0)      # local +Z (front) → phone −Y (toward the camera)
    ob.pass_index = 2
    ob['rect_pt'] = list(rect_pt)
    ob['screen_pt_centre'] = list(screen_pt_centre)
    return ob


def slab_key(ob, f, lift_mm, scale=1.0, visible=True):
    ob.location.y = (Y_DISPLAY_MM - lift_mm) * MM
    ob.keyframe_insert('location', frame=f)
    ob.scale = (scale, scale, scale)
    ob.keyframe_insert('scale', frame=f)
    ob.hide_render = not visible
    ob.keyframe_insert('hide_render', frame=f)
    ob.hide_viewport = not visible
    ob.keyframe_insert('hide_viewport', frame=f)


def slab_mix_key(ob, f, fac):
    nt = ob.data.materials[0].node_tree
    nt.nodes['SlabMix'].inputs['Fac'].default_value = fac
    nt.keyframe_insert(data_path='nodes["SlabMix"].inputs[0].default_value', frame=f)


# ----------------------------------------------------------------------------- shadow pass
def shadow_setup(scene, slabs):
    """TECH §3: Screen as shadow catcher (white diffuse stand-in), phone parts + studio hidden, slabs non-emissive,
    a dedicated 0.12 m area key at (−0.25, −0.45, 0.35) 40 W. Render at --pct 50."""
    for o in R.PHONE_PARTS:
        o.hide_render = o.name != 'Screen'
    scr = bpy.data.objects['Screen']
    scr.is_shadow_catcher = True
    scene.camera.data.dof.use_dof = False
    if scene.camera.data.animation_data:
        scene.camera.data.animation_data_clear()
    m_plain = bpy.data.materials.new('SlabPlain')
    m_plain.use_nodes = True
    m_plain.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.2, 0.2, 0.2, 1)
    for ob in slabs:
        for i in range(len(ob.data.materials)):
            ob.data.materials[i] = m_plain
    m_catch = bpy.data.materials.new('CatcherWhite')
    m_catch.use_nodes = True
    m_catch.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
    scr.data.materials[0] = m_catch
    for o in bpy.data.objects:
        if o.type == 'LIGHT' or o.name.startswith('Soft') or o.name.startswith('Side') or o.name in ('SheenCard', 'PureReflect'):
            o.hide_render = True
    ld = bpy.data.lights.new('ShadowKey', 'AREA')
    ld.shape = 'SQUARE'
    ld.size = 0.12
    ld.energy = 40.0
    lo = bpy.data.objects.new('ShadowKey', ld)
    scene.collection.objects.link(lo)
    lo.location = (-0.25, -0.45, 0.35)
    lo.rotation_euler = (Vector((0, 0, 0)) - Vector(lo.location)).to_track_quat('-Z', 'Y').to_euler()
    bgn = scene.world.node_tree.nodes.get('Background')
    if bgn:
        bgn.inputs['Strength'].default_value = 0.0
    scene.view_layers[0].cycles.use_pass_shadow_catcher = True
    scene.render.use_motion_blur = False
    return lo


# ----------------------------------------------------------------------------- passes
def _set_format(fmt, file_format, color_mode=None, color_depth=None, codec=None):
    if hasattr(fmt, 'media_type'):
        fmt.media_type = 'MULTI_LAYER_IMAGE' if file_format == 'OPEN_EXR_MULTILAYER' else 'IMAGE'
    fmt.file_format = file_format
    if color_mode:
        fmt.color_mode = color_mode
    if color_depth:
        fmt.color_depth = color_depth
    if codec:
        fmt.exr_codec = codec


_PASSES = {}


def passes(scene, outdir, mattes=True, shadow=False, z=False):
    """Blender 5 compositor (TECH §4): the main output is the Composite (beauty, written by render()); a File Output
    node writes matte_phone/cards/screen (ID Mask 1/2/3, AA, FLOAT → value in RGB and alpha), shadow (Shadow Catcher
    pass) and Z (float EXR) into outdir/_tmp/, moved to outdir/<item>/<frame>.png by render()."""
    vl = scene.view_layers[0]
    vl.use_pass_object_index = mattes
    vl.use_pass_z = z
    if shadow:
        vl.cycles.use_pass_shadow_catcher = True
    scene.render.use_compositing = True
    scene.use_nodes = True
    ng = bpy.data.node_groups.new('FilmComp', 'CompositorNodeTree')
    scene.compositing_node_group = ng
    rl = ng.nodes.new('CompositorNodeRLayers')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    gout = ng.nodes.new('NodeGroupOutput')
    ng.links.new(rl.outputs['Image'], gout.inputs['Image'])           # the main output = beauty (Combined)
    items = []
    tmp = os.path.join(outdir, '_tmp')
    os.makedirs(tmp, exist_ok=True)
    fo = ng.nodes.new('CompositorNodeOutputFile')
    fo.directory = tmp
    fo.file_name = 'p_'
    _set_format(fo.format, 'PNG', 'RGBA', '8')
    if mattes:
        for i, slot in ((1, 'matte_phone'), (2, 'matte_cards'), (3, 'matte_screen')):
            fo.file_output_items.new('FLOAT', slot)
            idm = ng.nodes.new('CompositorNodeIDMask')
            idm.inputs['Index'].default_value = i
            idm.inputs['Anti-Alias'].default_value = True
            ng.links.new(rl.outputs['Object Index'], idm.inputs['ID value'])
            ng.links.new(idm.outputs['Alpha'], fo.inputs[slot])
            items.append((slot, 'png'))
    if shadow:
        fo.file_output_items.new('FLOAT', 'shadow')
        ng.links.new(rl.outputs['Shadow Catcher'], fo.inputs['shadow'])
        items.append(('shadow', 'png'))
    if z:
        it = fo.file_output_items.new('FLOAT', 'Z')
        it.override_node_format = True
        _set_format(it.format, 'OPEN_EXR', 'RGB', '32', 'ZIP')
        ng.links.new(rl.outputs['Depth'], fo.inputs['Z'])
        items.append(('Z', 'exr'))
    _PASSES[outdir] = (tmp, items)
    return items


def _collect_passes(outdir, f):
    if outdir not in _PASSES:
        return
    tmp, items = _PASSES[outdir]
    for name, ext in items:
        hits = sorted(glob.glob(os.path.join(tmp, 'p_' + name + '*.' + ext)))
        if hits:
            d = os.path.join(outdir, name)
            os.makedirs(d, exist_ok=True)
            os.replace(hits[-1], os.path.join(d, '%04d.%s' % (f, ext)))
            for h in hits[:-1]:
                os.remove(h)


# ----------------------------------------------------------------------------- corners / matrix3d
def _homography(src, dst):
    A = []
    for (x, y), (X, Y) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -X * x, -X * y, -X])
        A.append([0, 0, 0, x, y, 1, -Y * x, -Y * y, -Y])
    A = np.array(A, dtype=np.float64)
    _, _, vt = np.linalg.svd(A)
    H = vt[-1].reshape(3, 3)
    return H / H[2, 2]


def css_matrix3d(H):
    h = H
    v = [h[0, 0], h[1, 0], 0, h[2, 0], h[0, 1], h[1, 1], 0, h[2, 1], 0, 0, 1, 0, h[0, 2], h[1, 2], 0, h[2, 2]]
    return 'matrix3d(' + ', '.join('%.8g' % x for x in v) + ')'


def corners(scene, f, px_w=1920, px_h=1080):
    """4 display corners (TL TR BR BL) in px at 1080p + the CSS matrix3d for a 402×874 pt element at (0,0)."""
    scene.frame_set(f)
    bpy.context.view_layer.update()
    cam = scene.camera
    scr = bpy.data.objects['Screen']
    xs = [v.co.x for v in scr.data.vertices]
    zs = [v.co.z for v in scr.data.vertices]
    y = scr.data.vertices[0].co.y
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    M = scr.matrix_world
    pts = []
    for lx, lz in ((x0, z1), (x1, z1), (x1, z0), (x0, z0)):
        p = world_to_camera_view(scene, cam, M @ Vector((lx, y, lz)))
        pts.append((p.x * px_w, (1 - p.y) * px_h))
    H = _homography([(0, 0), (402, 0), (402, 874), (0, 874)], pts)
    CORNERS[f] = {'corners_px': [[round(x, 3), round(y, 3)] for x, y in pts], 'matrix3d': css_matrix3d(H)}
    return CORNERS[f]


def write_corners(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    old = {}
    if os.path.exists(path):
        try:
            old = json.load(open(path)).get('frames', {})
        except Exception:
            old = {}
    old.update({str(k): v for k, v in CORNERS.items()})
    with open(path, 'w') as fh:
        json.dump({'note': 'per film frame: display corners TL TR BR BL in px at 1920x1080 and the CSS matrix3d for a '
                           '402x874 pt element at (0,0) with transform-origin 0 0 (TECH §5); Apple Motion Four Corner '
                           'takes the corners directly', 'frames': dict(sorted(old.items(), key=lambda kv: int(kv[0])))}, fh)


# ----------------------------------------------------------------------------- render loop
def set_border(scene, root, f, margin=0.015, extra_box=None):
    if extra_box:
        keep = R.BOX_MM
        R.BOX_MM = extra_box
        try:
            return R.set_border(scene, root, f, margin)
        finally:
            R.BOX_MM = keep
    return R.set_border(scene, root, f, margin)


def render(scene, root, frames, pct, samples, border, outdir, force=False, denoise=None, label='beauty',
           box_mm=None, margin=0.015, log_extra=None):
    """per frame: border (phone bbox + mblur span), render → outdir/<label>/<frame>.png, passes collected, corners,
    log.json (s/frame). Skips frames already on disk unless force."""
    set_samples(scene, samples, pct, denoise)
    os.makedirs(os.path.join(outdir, label), exist_ok=True)
    logp = os.path.join(outdir, 'log.json')
    log = json.load(open(logp)) if os.path.exists(logp) else {'frames': {}}
    times = []
    for f in frames:
        out = os.path.join(outdir, label, '%04d.png' % f)
        if os.path.exists(out) and not force:
            print('SKIP %d (exists)' % f, flush=True)
            continue
        scene.frame_set(f)
        if border:
            area = set_border(scene, root, f, margin, box_mm)
        else:
            scene.render.use_border = False
            area = 1.0
        t0 = time.time()
        R.render_to(scene, out)
        dt = time.time() - t0
        _collect_passes(outdir, f)
        try:
            corners(scene, f)
        except Exception as e:  # the droplet scene has no Screen
            pass
        times.append(dt)
        log['frames'][str(f)] = {'s': round(dt, 2), 'pct': pct, 'samples': samples, 'border_area': round(area, 3),
                                 'pass': label, 'load1': round(os.getloadavg()[0], 2)}
        if log_extra:
            log['frames'][str(f)].update(log_extra)
        with open(logp, 'w') as fh:
            json.dump(log, fh)
        print('FRAME %s %d %.1fs (border %.2f)' % (label, f, dt, area), flush=True)
    if times:
        print('DONE %s frames=%d avg=%.2fs total=%.0fs' % (label, len(times), sum(times) / len(times), sum(times)), flush=True)
    if CORNERS:
        write_corners(os.path.join(outdir, 'corners.json'))
    if SPEED:
        write_speed(os.path.join(outdir, 'pose_speed.json'))
    return times


def outdir_for(shot_id, args):
    if args.out:
        return args.out
    return os.path.join(RENDERS, shot_id + ('_prev' if args.preview else ''))


def apply_preview(args):
    if args.preview:
        args.pct = 50
        args.samples = args.samples or 6
        args.no_denoise = True
    return args


def contact_sheet(frames_paths, path, cols=4, tile=(480, 270), bg=(24, 26, 30), labels=None):
    from PIL import Image, ImageDraw
    rows = (len(frames_paths) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tile[0], rows * (tile[1] + 22)), bg)
    d = ImageDraw.Draw(sheet)
    for i, p in enumerate(frames_paths):
        r, c = divmod(i, cols)
        im = Image.open(p).convert('RGBA')
        b = Image.new('RGBA', im.size, (0, 0, 0, 255))
        b.alpha_composite(im)
        sheet.paste(b.convert('RGB').resize(tile, Image.LANCZOS), (c * tile[0], r * (tile[1] + 22)))
        d.text((c * tile[0] + 6, r * (tile[1] + 22) + tile[1] + 4), labels[i] if labels else os.path.basename(p), fill=(220, 220, 220))
    sheet.save(path)
    return path
