"""Render the iPhone shots / compositing layers (deterministic, CPU Cycles, one Blender at a time).

usage: <venv>/bin/python tools/render_iphone.py <shot> [--frames a-b] [--screen PNG] [--pct N] [--samples N]
  shots:
    front      : 4K (3840x2160) layers front_body.png + front_glass.png (+ front_glass_screen.png),
                 front_shadow.png, screen_rect.json (projected + alpha-verified), front_full_test.png (1080p)
    front_body | front_glass | front_post    (the three steps of `front`, individually)
    flyin      : 90 frames  renders/flyin/0000..0089.png   (1920x1080 RGBA, last frame = front pose)
    tiltout    : 45 frames  renders/tiltout/0000..0044.png (first frame = front pose)
    hero_34    : hero_34.png (1920x1080 RGBA)          back : back.png
    front3d    : renders/front3d.png  full 3D front pose at 1080p (QC: equals flyin frame 89)
    colortest  : renders/colortest.png + printed per-patch error (test pattern, glass hidden)
    contact    : contact.png (flyin 0/30/60/89 + front_full_test + hero_34)
  --frames a-b : 0-based frame indices (e.g. 0-89, 88-89, 0,30,60,89)
  --screen PNG : screen texture (1206x2622 sRGB). default: ../site/screen_home.png (tiltout: screen_cart.png),
                 falls back to testpattern.png
  --pct N      : resolution percentage of 1920x1080 (front layers are always rendered at 200 %)
  --samples N  : override Cycles samples
"""
import argparse
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
SITE = os.path.abspath(os.path.join(ROOT, '..', 'site'))
RENDERS = os.path.join(ROOT, 'renders')
MM = 0.001
FLYIN_N, TILT_N = 90, 45

PHONE_PARTS = None  # filled after load


# ----------------------------------------------------------------------------- easing
def expo_out(t, k):
    t = min(max(t, 0.0), 1.0)
    return (1 - 2 ** (-k * t)) / (1 - 2 ** (-k))


def bump(t, t0, t1):
    if t <= t0 or t >= t1:
        return 0.0
    return math.sin(math.pi * (t - t0) / (t1 - t0)) ** 2


def ease_in_out_cubic(t):
    t = min(max(t, 0.0), 1.0)
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def ease_in_out_sine(t):
    t = min(max(t, 0.0), 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def compose(spin, tilt, roll):
    """world rotation: spin about the phone long axis (world Z at rest), then tilt (X), then roll (Y)."""
    qs = Quaternion((0, 0, 1), math.radians(spin))
    qt = Quaternion((1, 0, 0), math.radians(tilt))
    qr = Quaternion((0, 1, 0), math.radians(roll))
    return qr @ qt @ qs


# poses: (spin deg, tilt deg, roll deg, location m)
FLY0 = (205.0, -16.0, 13.0, Vector((0.095, 0.12, -0.080)))
TILT1 = (26.0, -14.0, -4.0, Vector((0.012, 0.050, 0.010)))
BACK = (208.0, -9.0, 7.0, Vector((0.0, 0.03, 0.0)))


def pose(shot, t):
    if shot == 'flyin':
        s0, ti0, r0, l0 = FLY0
        e = expo_out(t, 6.0) + 0.032 * bump(t, 0.42, 1.0)   # overshoot ~1.4 deg past the target, settles
        el = expo_out(t, 5.0)
        er = expo_out(t, 4.5)
        spin = s0 * (1 - e)
        tilt = ti0 * (1 - er)
        roll = r0 * (1 - er) - 0.9 * bump(t, 0.35, 1.0)
        loc = l0 * (1 - el)
        if t >= 1.0:
            spin, tilt, roll, loc = 0.0, 0.0, 0.0, Vector((0, 0, 0))
        return loc, compose(spin, tilt, roll)
    if shot == 'tiltout':
        s1, ti1, r1, l1 = TILT1
        e = ease_in_out_cubic(t) * 0.82 + ease_in_out_sine(t) * 0.18
        el = t * t
        if t <= 0.0:
            return Vector((0, 0, 0)), Quaternion()
        return l1 * el, compose(s1 * e, ti1 * e, r1 * e)
    if shot in ('hero_34',):
        return pose('tiltout', 1.0)
    if shot == 'back':
        s, ti, r, l = BACK
        return l, compose(s, ti, r)
    return Vector((0, 0, 0)), Quaternion()


# ----------------------------------------------------------------------------- scene helpers
def load():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, 'iphone.blend'))
    global PHONE_PARTS
    root = bpy.data.objects['iPhone']
    PHONE_PARTS = [o for o in bpy.data.objects if o.parent == root]
    return bpy.context.scene, root


def default_screen(shot):
    if shot == 'tiltout' and os.path.exists(os.path.join(SITE, 'screen_cart.png')):
        return os.path.join(SITE, 'screen_cart.png')
    p = os.path.join(SITE, 'screen_home.png')
    return p if os.path.exists(p) else os.path.join(ROOT, 'testpattern.png')


def set_screen(path):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = 'sRGB'
    node = bpy.data.materials['Screen'].node_tree.nodes['ScreenImage']
    node.image = img
    print('screen texture:', path, tuple(img.size), flush=True)


def set_pose(root, loc, quat):
    root.location = loc
    root.rotation_mode = 'QUATERNION'
    root.rotation_quaternion = quat


BOX_MM = [(x, y, z) for x in (-37.0, 37.0) for y in (-4.6, 8.0) for z in (-75.5, 75.5)]  # phone + camera bump


def set_border(scene, root, frame=None, margin=0.015):
    """render only the phone's projected bounding box (+ motion-blur span): far less tracing + denoising."""
    cam = scene.camera
    pts = []
    times = [frame] if frame is None else [frame - 0.3, frame, frame + 0.3]
    bpy.context.view_layer.update()
    for ft in times:
        if ft is not None:
            scene.frame_set(int(math.floor(ft)), subframe=ft - math.floor(ft))
        M = root.matrix_world.copy()
        for c in BOX_MM:
            p = world_to_camera_view(scene, cam, M @ Vector([v * MM for v in c]))
            pts.append((p.x, p.y))
    if frame is not None:
        scene.frame_set(frame)
    x0 = max(0.0, min(p[0] for p in pts) - margin)
    x1 = min(1.0, max(p[0] for p in pts) + margin)
    y0 = max(0.0, min(p[1] for p in pts) - margin)
    y1 = min(1.0, max(p[1] for p in pts) + margin)
    r = scene.render
    r.use_border = True
    r.use_crop_to_border = False
    r.border_min_x, r.border_max_x, r.border_min_y, r.border_max_y = x0, x1, y0, y1
    return (x1 - x0) * (y1 - y0)


def render_to(scene, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    return time.time() - t0


def parse_frames(spec, n):
    if not spec or spec == 'all':
        return list(range(n))
    out = []
    for part in spec.split(','):
        if '-' in part:
            a, b = part.split('-')
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return [f for f in out if 0 <= f < n]


# ----------------------------------------------------------------------------- image io (numpy)
def read_png(path):
    from PIL import Image
    im = Image.open(path)
    if im.mode == 'I;16' or im.mode == 'I':
        raise SystemExit('unexpected mode')
    a = np.asarray(im.convert('RGBA'), dtype=np.float64) / 255.0
    return a


def read_png16(path):
    """read an RGBA PNG (8 or 16 bit) via Blender to keep 16-bit precision; returns float HxWx4 (straight)."""
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = 'Non-Color'
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[::-1].astype(np.float64)


def write_png(path, arr, mode='RGBA', dither=True):
    from PIL import Image
    a = np.clip(arr, 0, 1) * 255.0
    if dither:
        rng = np.random.default_rng(5)
        a = a + rng.uniform(-0.5, 0.5, a.shape)
    a = np.clip(np.round(a), 0, 255).astype(np.uint8)
    Image.fromarray(a, mode).save(path, optimize=False, compress_level=6)


def _box(a, r, axis):
    a = np.moveaxis(a, axis, 0)
    pad = np.concatenate([np.repeat(a[:1], r + 1, 0), a, np.repeat(a[-1:], r, 0)], 0)
    c = np.cumsum(pad, 0)
    out = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
    return np.moveaxis(out, 0, axis)


def gaussian(arr, sigma):
    """gaussian blur approximated by 3 box passes per axis (float, edge-clamped)."""
    r = max(1, int(round((math.sqrt(12 * sigma * sigma / 3 + 1) - 1) / 2)))
    out = arr.astype(np.float64)
    for axis in (0, 1):
        for _ in range(3):
            out = _box(out, r, axis)
    return out


def resize_premul(rgba, size):
    """resize straight RGBA (float) to size=(w,h) with premultiplied-alpha Lanczos."""
    from PIL import Image
    pm = rgba.copy()
    pm[..., :3] *= pm[..., 3:4]
    chans = []
    for c in range(4):
        im = Image.fromarray(pm[..., c].astype(np.float32), 'F')
        chans.append(np.asarray(im.resize(size, Image.LANCZOS), dtype=np.float64))
    out = np.clip(np.stack(chans, -1), 0, 1)
    a = out[..., 3:4]
    out[..., :3] = np.where(a > 1e-6, out[..., :3] / np.maximum(a, 1e-6), 0)
    return np.clip(out, 0, 1)


# ----------------------------------------------------------------------------- screen rect
def project_rects(scene):
    cam = scene.camera
    rx = scene.render.resolution_x * scene.render.resolution_percentage / 100
    ry = scene.render.resolution_y * scene.render.resolution_percentage / 100
    scr = bpy.data.objects['Screen']
    x0, y0, x1, y1 = scr['disp_bbox_mm']
    wy = min(v.co.y for v in scr.data.vertices)  # screen plane depth (world, front pose)

    def proj(u, v, wdepth):
        p = world_to_camera_view(scene, cam, Vector((u * MM, wdepth, v * MM)))
        return p.x * rx, (1 - p.y) * ry
    ax, ay = proj(x0, y1, wy)
    bx, by = proj(x1, y0, wy)
    pxmm = (bx - ax) / (x1 - x0)
    # equivalent CSS radius: circle through the 45-degree point of the squircle corner
    pts = [(v.co.x / MM, v.co.z / MM) for v in scr.data.vertices]
    tr = [p for p in pts if p[0] > 0 and p[1] > 0]
    best = min(tr, key=lambda p: abs((x1 - p[0]) - (y1 - p[1])))
    c = x1 - best[0]
    r_eq = c / (1 - 1 / math.sqrt(2))
    # largest circular CSS radius whose rounded rect still covers the whole squircle hole (no gaps)
    def gap(R):
        cx, cy = x1 - R, y1 - R
        return max([math.hypot(p[0] - cx, p[1] - cy) - R for p in tr if p[0] > cx and p[1] > cy] or [-1])
    lo, hi = 0.0, r_eq
    for _ in range(40):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if gap(mid) <= 1e-4 else (lo, mid)
    r_cover = lo
    gap_eq = max(0.0, gap(r_eq))
    # corner extent: where the outline leaves the straight top edge
    straight = [p for p in tr if abs(p[1] - y1) < 1e-4]
    ext = x1 - max(p[0] for p in straight) if straight else r_eq
    isl = bpy.data.objects['Island']
    iv = [(v.co.x / MM, v.co.z / MM) for v in isl.data.vertices]
    iwy = isl.data.vertices[0].co.y
    ix0, ix1 = min(p[0] for p in iv), max(p[0] for p in iv)
    iy0, iy1 = min(p[1] for p in iv), max(p[1] for p in iv)
    iax, iay = proj(ix0, iy1, iwy)
    ibx, iby = proj(ix1, iy0, iwy)
    return {
        'screen': {'x': ax, 'y': ay, 'w': bx - ax, 'h': by - ay, 'radius': r_eq * pxmm,
                   'radius_cover': r_cover * pxmm, 'radius_eq_max_gap': gap_eq * pxmm,
                   'corner_extent': ext * pxmm},
        'island': {'x': iax, 'y': iay, 'w': ibx - iax, 'h': iby - iay, 'radius': (iby - iay) / 2},
        'px_per_mm': pxmm,
    }


def silhouette_bbox(alpha, thr=0.5):
    ys, xs = np.where(alpha > thr)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def edge_cross(profile, thr=0.5):
    """sub-pixel positions where a 1D alpha profile crosses thr."""
    out = []
    for i in range(len(profile) - 1):
        a, b = profile[i], profile[i + 1]
        if (a - thr) * (b - thr) < 0:
            out.append(i + 0.5 + (thr - a) / (b - a))  # pixel centres at i+0.5
    return out


# ----------------------------------------------------------------------------- front layers
def setup_front(scene, root, pct=200):
    set_pose(root, Vector((0, 0, 0)), Quaternion())
    scene.render.resolution_percentage = pct
    scene.render.use_motion_blur = False
    for o in PHONE_PARTS:
        o.is_holdout = False
        o.hide_render = False
    set_border(scene, root, margin=0.01)


def front_body(scene, root, samples):
    setup_front(scene, root)
    scene.cycles.samples = samples or 32
    bpy.data.objects['GlassScreen'].hide_render = True
    bpy.data.objects['Screen'].is_holdout = True
    dt = render_to(scene, os.path.join(ROOT, 'front_body.png'))
    print('FRONT_BODY %.1fs' % dt, flush=True)


def front_glass(scene, root, samples):
    setup_front(scene, root)
    scene.cycles.samples = samples or 32
    # reflection only: the display renders black (opaque), the island black, everything else is held out
    for o in PHONE_PARTS:
        if o.name not in ('GlassScreen', 'Screen', 'Island'):
            o.is_holdout = True
    bpy.data.materials['Screen'].node_tree.nodes['ScreenEmission'].inputs['Strength'].default_value = 0.0
    scene.render.image_settings.color_depth = '16'
    raw = os.path.join(RENDERS, '_front_glass_raw.png')
    dt = render_to(scene, raw)
    scene.render.image_settings.color_depth = '8'
    print('FRONT_GLASS %.1fs' % dt, flush=True)
    g = read_png16(raw)
    pm = g[..., :3] * g[..., 3:4]                      # reflection light over black (sRGB-encoded)
    write_png(os.path.join(ROOT, 'front_glass_screen.png'), pm, mode='RGB')
    a = pm.max(axis=2, keepdims=True)
    col = np.where(a > 1e-5, pm / np.maximum(a, 1e-5), 1.0)
    write_png(os.path.join(ROOT, 'front_glass.png'), np.concatenate([col, a], -1), mode='RGBA')
    print('glass max %.3f (sRGB), mean over screen %.4f' % (pm.max(), pm[g[..., 3] > 0].mean()), flush=True)


def rounded_rect_mask(W_, H_, r, ss=1):
    x, y, w, h, rad = r['x'], r['y'], r['w'], r['h'], r['radius']
    yy, xx = np.mgrid[0:H_, 0:W_] + 0.5
    cx = np.clip(xx, x + rad, x + w - rad)
    cy = np.clip(yy, y + rad, y + h - rad)
    d = np.hypot(xx - cx, yy - cy) - rad
    return np.clip(0.5 - d, 0, 1)


def front_post(scene, root, screen_png):
    setup_front(scene, root)
    rects4k = project_rects(scene)
    body = read_png(os.path.join(ROOT, 'front_body.png'))
    Hh, Ww = body.shape[:2]
    alpha = body[..., 3]
    s = rects4k['screen']
    # --- verify the hole against the projection (alpha crossings, sub-pixel)
    row = int(s['y'] + s['h'] * 0.5)
    col_x = int(s['x'] + s['w'] * 0.78)
    xs = edge_cross(alpha[row, :])
    ys = edge_cross(alpha[:, col_x])
    inner_x = [v for v in xs if s['x'] - 6 < v < s['x'] + 6] + [v for v in xs if s['x'] + s['w'] - 6 < v < s['x'] + s['w'] + 6]
    inner_y = [v for v in ys if s['y'] - 6 < v < s['y'] + 6] + [v for v in ys if s['y'] + s['h'] - 6 < v < s['y'] + s['h'] + 6]
    hole_inside = alpha[int(s['y'] + 20):int(s['y'] + s['h'] - 20), int(s['x'] + 20):int(s['x'] + s['w'] - 20)]
    isl = rects4k['island']
    isl_alpha = alpha[int(isl['y'] + isl['h'] / 2), int(isl['x'] + isl['w'] / 2)]
    sx0, sy0, sx1, sy1 = silhouette_bbox(alpha)
    verify = {
        'hole_left_right_alpha_crossings_px': inner_x,
        'hole_top_bottom_alpha_crossings_px': inner_y,
        'projected_left_right_px': [s['x'], s['x'] + s['w']],
        'projected_top_bottom_px': [s['y'], s['y'] + s['h']],
        'max_error_px': max([abs(a - b) for a, b in zip(inner_x, [s['x'], s['x'] + s['w']])] +
                            [abs(a - b) for a, b in zip(inner_y, [s['y'], s['y'] + s['h']])] or [99]),
        'fraction_of_hole_transparent': float((hole_inside < 0.01).mean()),
        'island_centre_alpha': float(isl_alpha),
        'phone_silhouette_px_4k': [int(sx0), int(sy0), int(sx1 - sx0), int(sy1 - sy0)],
    }

    def rnd(d, k):
        return {kk: round(v * k, 2) for kk, v in d.items()}
    out = {
        'note': 'top-left origin, px. screen = active display opening (holdout) in front_body.png; its corners '
                'are superellipse (squircle) curves. radius_cover = CSS border-radius to give the screen content '
                'placed UNDER front_body (largest circular radius that still covers the whole hole: the content '
                'corners that poke out are hidden by the opaque bezel). radius = circle-equivalent radius (same '
                '45-degree point; leaves up to radius_eq_max_gap px uncovered near the tangents). '
                'Stack (bottom->top): front_shadow, screen content, front_body, front_glass (normal blend) or '
                'front_glass_screen (mix-blend-mode: screen).',
        '3840x2160': {'screen': rnd(s, 1), 'island': rnd(isl, 1), 'phone_bbox': verify['phone_silhouette_px_4k']},
        '1920x1080': {'screen': rnd(s, 0.5), 'island': rnd(isl, 0.5),
                      'phone_bbox': [v / 2 for v in verify['phone_silhouette_px_4k']]},
        'screen_texture_px': [1206, 2622],
        'verification': verify,
    }
    with open(os.path.join(ROOT, 'screen_rect.json'), 'w') as fh:
        json.dump(out, fh, indent=1)
    print(json.dumps(out['1920x1080'], indent=1), '\nverify', json.dumps(verify), flush=True)

    # --- shadow (synthesised from the filled silhouette, 3 layers: contact / key / ambient)
    sil = np.maximum(alpha, rounded_rect_mask(Ww, Hh, s))
    sh = np.zeros_like(sil)
    for sigma, dy, op in ((7, 6, 0.30), (38, 46, 0.26), (120, 140, 0.16)):
        b = gaussian(sil, sigma)
        b = np.roll(b, dy, axis=0)
        sh = 1 - (1 - sh) * (1 - op * b)
    shadow = np.zeros((Hh, Ww, 4))
    shadow[..., :3] = np.array([10, 20, 42]) / 255.0
    shadow[..., 3] = sh
    write_png(os.path.join(ROOT, 'front_shadow.png'), shadow)

    # --- QC composite at 1080p: background, shadow, content, body, glass (screen blend)
    composite_front(out['1920x1080']['screen'], screen_png, os.path.join(ROOT, 'front_full_test.png'))


def place_content(rect, screen_png, size=(1920, 1080)):
    """screen PNG placed exactly (sub-pixel) in rect like a browser would, clipped by radius_cover. RGBA float."""
    from PIL import Image
    scr = Image.open(screen_png).convert('RGB')
    sw, sh = scr.size
    pad = 8
    padded = np.pad(np.asarray(scr), ((pad, pad), (pad, pad), (0, 0)), mode='edge')
    src = Image.fromarray(padded)
    x, y, w, h = rect['x'], rect['y'], rect['w'], rect['h']
    X0, Y0 = int(math.floor(x)), int(math.floor(y))
    X1, Y1 = int(math.ceil(x + w)), int(math.ceil(y + h))
    box = (pad + (X0 - x) / w * sw, pad + (Y0 - y) / h * sh, pad + (X1 - x) / w * sw, pad + (Y1 - y) / h * sh)
    im = src.resize((X1 - X0, Y1 - Y0), Image.LANCZOS, box=box)
    out = np.zeros((size[1], size[0], 4))
    out[Y0:Y1, X0:X1, :3] = np.asarray(im, dtype=np.float64) / 255.0
    out[..., 3] = rounded_rect_mask(size[0], size[1], dict(rect, radius=rect['radius_cover']))
    return out


def composite_front(rect, screen_png, path, bg=(0.93, 0.95, 0.975)):
    from PIL import Image
    size = (1920, 1080)
    canvas = np.ones((1080, 1920, 3)) * np.array(bg)

    def over(dst, src):
        a = src[..., 3:4]
        return src[..., :3] * a + dst * (1 - a)
    shadow = resize_premul(read_png(os.path.join(ROOT, 'front_shadow.png')), size)
    canvas = over(canvas, shadow)
    canvas = over(canvas, place_content(rect, screen_png))
    body = resize_premul(read_png(os.path.join(ROOT, 'front_body.png')), size)
    canvas = over(canvas, body)
    gl = np.asarray(Image.open(os.path.join(ROOT, 'front_glass_screen.png')).convert('RGB').resize(size, Image.LANCZOS),
                    dtype=np.float64) / 255.0
    canvas = 1 - (1 - canvas) * (1 - gl)
    write_png(path, canvas, mode='RGB', dither=False)
    print('wrote', path, flush=True)


# ----------------------------------------------------------------------------- QC
def colortest(scene, root):
    setup_front(scene, root, pct=100)
    set_screen(os.path.join(ROOT, 'testpattern.png'))
    scene.cycles.samples = 16
    path = os.path.join(RENDERS, 'colortest.png')
    for glass in (False, True):
        bpy.data.objects['GlassScreen'].hide_render = not glass
        p = path if not glass else path.replace('.png', '_glass.png')
        render_to(scene, p)
        img = read_png(p)
        rect = project_rects(scene)['screen']
        tp = json.load(open(os.path.join(ROOT, 'testpattern.json')))
        errs = []
        for pt in tp['patches']:
            X = rect['x'] + pt['cx'] / 1206 * rect['w']
            Y = rect['y'] + pt['cy'] / 2622 * rect['h']
            win = img[int(Y) - 4:int(Y) + 5, int(X) - 4:int(X) + 5, :3].reshape(-1, 3).mean(0) * 255
            errs.append(np.abs(win - np.array(pt['rgb'])).max())
            print('patch', pt['rgb'], '->', np.round(win, 1), flush=True)
        print('COLORTEST glass=%s max abs error %.2f levels, mean %.2f' % (glass, max(errs), np.mean(errs)), flush=True)


def contact():
    from PIL import Image, ImageDraw, ImageFont
    tiles = [('flyin 0', os.path.join(RENDERS, 'flyin', '0000.png')),
             ('flyin 30', os.path.join(RENDERS, 'flyin', '0030.png')),
             ('flyin 60', os.path.join(RENDERS, 'flyin', '0060.png')),
             ('flyin 89', os.path.join(RENDERS, 'flyin', '0089.png')),
             ('front_full_test', os.path.join(ROOT, 'front_full_test.png')),
             ('hero_34', os.path.join(ROOT, 'hero_34.png'))]
    tw, th = 640, 360
    sheet = Image.new('RGB', (tw * 3, (th + 34) * 2), (20, 22, 26))
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
    d = ImageDraw.Draw(sheet)
    for i, (label, p) in enumerate(tiles):
        r, c = divmod(i, 3)
        bg = Image.new('RGBA', (1920, 1080), (233, 237, 243, 255))
        if os.path.exists(p):
            im = Image.open(p).convert('RGBA')
            bg.alpha_composite(im)
        sheet.paste(bg.convert('RGB').resize((tw, th), Image.LANCZOS), (c * tw, r * (th + 34)))
        d.text((c * tw + 10, r * (th + 34) + th + 6), label, font=font, fill=(230, 230, 230))
    sheet.save(os.path.join(ROOT, 'contact.png'))
    print('wrote contact.png')


def cutcheck(screen_png):
    """QC of the 3D->2D cut: flyin frame 89 vs (content + front_body + front_glass) at 1080p, same background."""
    from PIL import Image
    rect = json.load(open(os.path.join(ROOT, 'screen_rect.json')))['1920x1080']['screen']
    bg = np.ones((1080, 1920, 3)) * np.array([0.93, 0.95, 0.975])

    def over(dst, src):
        return src[..., :3] * src[..., 3:4] + dst * (1 - src[..., 3:4])
    f3d = over(bg, read_png(os.path.join(RENDERS, 'flyin', '0089.png')))
    content = place_content(rect, screen_png)
    c2d = over(over(bg, content), resize_premul(read_png(os.path.join(ROOT, 'front_body.png')), (1920, 1080)))
    gl = np.asarray(Image.open(os.path.join(ROOT, 'front_glass_screen.png')).convert('RGB').resize(
        (1920, 1080), Image.LANCZOS), dtype=np.float64) / 255.0
    c2d = 1 - (1 - c2d) * (1 - gl)
    d = np.abs(f3d - c2d) * 255
    phone = d[80:1000, 730:1190]
    scr_reg = d[int(rect['y'] + 140):int(rect['y'] + rect['h'] - 10), int(rect['x'] + 10):int(rect['x'] + rect['w'] - 10)]
    print('CUTCHECK mean abs diff %.2f levels, p99 %.1f, max %.1f (phone region); screen below status bar: '
          'mean %.2f p99 %.1f' % (phone.mean(), np.percentile(phone, 99), phone.max(), scr_reg.mean(),
                                  np.percentile(scr_reg, 99)), flush=True)
    write_png(os.path.join(RENDERS, 'cutcheck_diff_x8.png'), np.clip(d / 255 * 8, 0, 1), mode='RGB', dither=False)
    return phone.mean()


# ----------------------------------------------------------------------------- shots
def render_sequence(scene, root, shot, frames, samples, pct, motion_blur=True, outdir=''):
    n = FLYIN_N if shot == 'flyin' else TILT_N
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    root.rotation_mode = 'QUATERNION'
    root.animation_data_clear()
    for f in range(n):
        loc, q = pose(shot, f / (n - 1))
        set_pose(root, loc, q)
        root.keyframe_insert('location', frame=f)
        root.keyframe_insert('rotation_quaternion', frame=f)
    scene.frame_start, scene.frame_end = 0, n - 1
    scene.render.resolution_percentage = pct
    scene.render.use_motion_blur = motion_blur
    scene.render.motion_blur_shutter = 0.5
    scene.cycles.samples = samples or 12
    outdir = outdir or os.path.join(RENDERS, shot)
    times = []
    for f in frames:
        scene.frame_set(f)
        set_border(scene, root, f)
        dt = render_to(scene, os.path.join(outdir, '%04d.png' % f))
        times.append(dt)
        print('FRAME %s %d %.1fs' % (shot, f, dt), flush=True)
    if times:
        print('DONE %s frames=%d avg=%.2fs total=%.0fs' % (shot, len(times), sum(times) / len(times), sum(times)),
              flush=True)


def main():
    argv = sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('shot')
    ap.add_argument('--frames', default='all')
    ap.add_argument('--screen', default='')
    ap.add_argument('--pct', type=int, default=100)
    ap.add_argument('--samples', type=int, default=0)
    ap.add_argument('--no-mblur', action='store_true')
    ap.add_argument('--out', default='')
    ap.add_argument('--exec', default='', help='debug: python run after setup')
    a = ap.parse_args(argv)
    if a.shot == 'contact':
        return contact()
    if a.shot == 'cutcheck':
        return cutcheck(a.screen or default_screen('flyin'))
    scene, root = load()
    screen_png = a.screen or default_screen(a.shot)
    set_screen(screen_png)
    if a.exec:
        exec(a.exec, {'bpy': bpy, 'scene': scene, 'root': root})
    if a.shot in ('front', 'front_body'):
        front_body(scene, root, a.samples)
    if a.shot in ('front', 'front_glass'):
        front_glass(scene, root, a.samples)
    if a.shot in ('front', 'front_post'):
        front_post(scene, root, screen_png)
    if a.shot in ('front', 'front_body', 'front_glass', 'front_post'):
        return
    if a.shot == 'colortest':
        return colortest(scene, root)
    if a.shot in ('flyin', 'tiltout'):
        n = FLYIN_N if a.shot == 'flyin' else TILT_N
        return render_sequence(scene, root, a.shot, parse_frames(a.frames, n), a.samples, a.pct,
                               motion_blur=not a.no_mblur, outdir=a.out)
    # stills
    scene.render.resolution_percentage = a.pct
    scene.cycles.samples = a.samples or 24
    if a.shot == 'front3d':
        loc, q = Vector((0, 0, 0)), Quaternion()
        path = os.path.join(RENDERS, 'front3d.png')
    elif a.shot in ('hero_34', 'back'):
        loc, q = pose(a.shot, 1.0)
        path = os.path.join(ROOT, a.shot + '.png') if a.shot != 'back' else os.path.join(ROOT, 'back.png')
    elif a.shot.startswith('pose:'):  # debug: pose:spin,tilt,roll,x,y,z
        v = [float(x) for x in a.shot[5:].split(',')]
        loc, q = Vector(v[3:6]), compose(*v[:3])
        path = os.path.join(RENDERS, 'preview.png')
    else:
        raise SystemExit('unknown shot ' + a.shot)
    if a.out:
        path = a.out
    set_pose(root, loc, q)
    set_border(scene, root)
    dt = render_to(scene, path)
    print('STILL %s %.1fs -> %s' % (a.shot, dt, path), flush=True)


if __name__ == '__main__':
    main()
