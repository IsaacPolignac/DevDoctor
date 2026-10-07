"""T4b: crisp HTML on the 3D screen of a TILTED phone — per-frame screen corners -> CSS matrix3d, proven on one frame.

usage: <blender-venv>/bin/python tools/tests/homography.py

Renders the tilted pose of cards_passes.py (no cards) three ways, with the production border crop, 16 samples:
  truth.png      full 3D phone (screen texture = clean/screen_cart.png), the reference
  body_hole.png  the phone with the Screen as holdout and GlassScreen hidden (production front_body recipe, per frame)
  glass_only.png cover-glass reflections over a black screen, everything else held out (production front_glass recipe)
Then projects the 4 display corners (world_to_camera_view) -> screen_corners.json (px at 1080p + CSS matrix3d for a
402x874 pt element), warps the 1206x2622 screen PNG with that homography in PIL, stacks bg + warped + body_hole +
glass_only (screen blend) and measures the difference against truth.png. Also writes html/ for a browser check.
"""
import json
import os
import sys
import time

import bpy  # noqa: must be imported before mathutils
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector  # noqa: E402
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PRO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(PRO, 'assets', 'iphone', 'tools'))
import render_iphone as R  # noqa: E402

OUT = os.path.join(HERE, 'out', 'homography')
os.makedirs(OUT, exist_ok=True)
CLEAN = os.path.join(PRO, 'assets', 'site', 'clean')
POSE = (14.0, -5.0, -2.0, Vector((0.012, 0.030, 0.0)))   # same as cards_passes.py
TEX = os.path.join(CLEAN, 'screen_cart.png')
PAD = 0
R_COVER_PT = 52.12          # CSS border-radius of the .ps screen element (pt) = radius_cover 51.9 px / K


def homography(src, dst):
    """3x3 H with dst ~ H @ src (4 point pairs, DLT)."""
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


def project_corners(scene):
    cam = scene.camera
    rx = scene.render.resolution_x * scene.render.resolution_percentage / 100
    ry = scene.render.resolution_y * scene.render.resolution_percentage / 100
    scr = bpy.data.objects['Screen']
    xs = [v.co.x for v in scr.data.vertices]
    zs = [v.co.z for v in scr.data.vertices]
    y = scr.data.vertices[0].co.y
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    M = scr.matrix_world
    corners = []
    for lx, lz in ((x0, z1), (x1, z1), (x1, z0), (x0, z0)):     # TL, TR, BR, BL (texture order)
        p = world_to_camera_view(scene, cam, M @ Vector((lx, y, lz)))
        corners.append((p.x * rx, (1 - p.y) * ry))
    return corners


def warp_texture(tex_path, corners, size=(1920, 1080), ss=2):
    """the 1206x2622 screen PNG warped onto the 4 corners (edge-padded by PAD px so the bezel covers the seam)."""
    tex = Image.open(tex_path).convert('RGB')
    tw, th = tex.size
    arr = np.pad(np.asarray(tex), ((PAD, PAD), (PAD, PAD), (0, 0)), mode='edge')
    padded = Image.fromarray(arr).convert('RGBA')
    # the same rounded clip as the 2D rig (.ps border-radius 52.12 pt): the squircle hole is fully covered, the
    # rectangle corners never poke out of the bezel on a tilted frame
    from PIL import ImageDraw
    mask = Image.new('L', padded.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((PAD, PAD, PAD + tw - 1, PAD + th - 1), radius=R_COVER_PT * tw / 402.0, fill=255)
    padded.putalpha(mask)
    src = [(PAD, PAD), (PAD + tw, PAD), (PAD + tw, PAD + th), (PAD, PAD + th)]
    dst = [(x * ss, y * ss) for x, y in corners]
    H = homography(src, dst)
    Hi = np.linalg.inv(H)
    Hi /= Hi[2, 2]
    coeffs = (Hi[0, 0], Hi[0, 1], Hi[0, 2], Hi[1, 0], Hi[1, 1], Hi[1, 2], Hi[2, 0], Hi[2, 1])
    big = padded.transform((size[0] * ss, size[1] * ss), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    return big.resize(size, Image.LANCZOS)


def main():
    scene, root = R.load()
    R.set_screen(TEX)
    spin, tilt, roll, loc = POSE
    R.set_pose(root, loc, R.compose(spin, tilt, roll))
    bpy.context.view_layer.update()
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1920, 1080, 100
    scene.render.use_motion_blur = False
    scene.cycles.samples = 16
    area = R.set_border(scene, root, margin=0.01)
    times = {}
    # (a) truth
    times['truth'] = R.render_to(scene, os.path.join(OUT, 'truth.png'))
    # (b) body with the screen hole
    bpy.data.objects['GlassScreen'].hide_render = True
    bpy.data.objects['Screen'].is_holdout = True
    times['body_hole'] = R.render_to(scene, os.path.join(OUT, 'body_hole.png'))
    bpy.data.objects['GlassScreen'].hide_render = False
    bpy.data.objects['Screen'].is_holdout = False
    # (c) glass reflections only
    for o in R.PHONE_PARTS:
        if o.name not in ('GlassScreen', 'Screen', 'Island'):
            o.is_holdout = True
    bpy.data.materials['Screen'].node_tree.nodes['ScreenEmission'].inputs['Strength'].default_value = 0.0
    times['glass_only'] = R.render_to(scene, os.path.join(OUT, 'glass_only.png'))
    for o in R.PHONE_PARTS:
        o.is_holdout = False
    bpy.data.materials['Screen'].node_tree.nodes['ScreenEmission'].inputs['Strength'].default_value = 1.0
    print('RENDER times', {k: round(v, 1) for k, v in times.items()}, 'border area %.2f' % area, flush=True)

    corners = project_corners(scene)
    H_pt = homography([(0, 0), (402, 0), (402, 874), (0, 874)], corners)
    info = {'frame_pose': {'spin': spin, 'tilt': tilt, 'roll': roll, 'loc_m': list(loc)},
            'corners_px_1080p_TL_TR_BR_BL': [[round(x, 3), round(y, 3)] for x, y in corners],
            'css_matrix3d_for_402x874pt_element_at_0_0_origin_0_0': css_matrix3d(H_pt),
            'note': 'HTML screen element 402x874 pt, position:absolute; left:0; top:0; transform-origin:0 0; transform: <matrix3d>. '
                    'Stack: HTML screen (under) -> body_hole.webm (alpha) -> glass_only.webm (mix-blend-mode: screen).'}
    json.dump(info, open(os.path.join(OUT, 'screen_corners.json'), 'w'), indent=1)
    print(json.dumps(info, indent=1), flush=True)

    # --- PIL composite vs truth
    bg = np.array([0.93, 0.95, 0.975])
    warped = np.asarray(warp_texture(TEX, corners), dtype=np.float64) / 255.0
    body = R.read_png(os.path.join(OUT, 'body_hole.png'))
    glass = R.read_png(os.path.join(OUT, 'glass_only.png'))
    truth = R.read_png(os.path.join(OUT, 'truth.png'))

    def over(dst, src):
        return src[..., :3] * src[..., 3:4] + dst * (1 - src[..., 3:4])
    comp = over(np.ones((1080, 1920, 3)) * bg, warped)
    comp = over(comp, body)
    gl = glass[..., :3] * glass[..., 3:4]                       # reflection light over black
    comp = 1 - (1 - comp) * (1 - gl)                            # screen blend
    ref = over(np.ones((1080, 1920, 3)) * bg, truth)
    d = np.abs(comp - ref) * 255
    ys, xs = np.where(truth[..., 3] > 0.5)
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    phone = d[by0:by1, bx0:bx1]
    # screen interior: shrink the quad by 12 px
    cx, cy = np.mean([c[0] for c in corners]), np.mean([c[1] for c in corners])
    inner = [(cx + (x - cx) * 0.94, cy + (y - cy) * 0.94) for x, y in corners]
    from PIL import ImageDraw
    m = Image.new('L', (1920, 1080), 0)
    ImageDraw.Draw(m).polygon([(float(x), float(y)) for x, y in inner], fill=255)
    m = np.asarray(m) > 0
    scr = d[m]
    metrics = {'phone_mean': round(float(phone.mean()), 2), 'phone_p99': round(float(np.percentile(phone, 99)), 1),
               'screen_mean': round(float(scr.mean()), 2), 'screen_p99': round(float(np.percentile(scr, 99)), 1),
               'screen_max': round(float(scr.max()), 1), 'render_s': {k: round(v, 1) for k, v in times.items()}}
    info['pil_composite_vs_truth_levels'] = metrics
    json.dump(info, open(os.path.join(OUT, 'screen_corners.json'), 'w'), indent=1)
    R.write_png(os.path.join(OUT, 'composite_pil.png'), comp, mode='RGB', dither=False)
    R.write_png(os.path.join(OUT, 'truth_over_bg.png'), ref, mode='RGB', dither=False)
    R.write_png(os.path.join(OUT, 'diff_x8.png'), np.clip(d / 255 * 8, 0, 1), mode='RGB', dither=False)
    # side by side crop (truth | composite | diff x8) around the phone
    crop = (max(0, bx0 - 20), max(0, by0 - 20), min(1920, bx1 + 20), min(1080, by1 + 20))
    tiles = [Image.open(os.path.join(OUT, f)).crop(crop) for f in ('truth_over_bg.png', 'composite_pil.png', 'diff_x8.png')]
    w, h = tiles[0].size
    sheet = Image.new('RGB', (w * 3 + 20, h), (20, 22, 26))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * (w + 10), 0))
    sheet.save(os.path.join(OUT, 'side_by_side.png'))
    # a static HTML page for the browser check (hyperframes snapshot): same stack with CSS matrix3d
    html = os.path.join(OUT, 'html')
    os.makedirs(html, exist_ok=True)
    Image.open(os.path.join(OUT, 'body_hole.png')).save(os.path.join(html, 'body_hole.png'))
    # glass as in front_glass.png: colour + alpha = max channel of the reflection light, normal blend
    ga = gl.max(axis=2, keepdims=True)
    gcol = np.where(ga > 1e-5, gl / np.maximum(ga, 1e-5), 1.0)
    R.write_png(os.path.join(html, 'glass_front.png'), np.concatenate([gcol, ga], -1), mode='RGBA')
    Image.open(TEX).save(os.path.join(html, 'screen_cart.png'))
    with open(os.path.join(html, 'index.html'), 'w') as fh:
        fh.write('''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#000}
#stage{position:relative;width:1920px;height:1080px;overflow:hidden;background:rgb(237,242,249)}
#stage img{position:absolute;left:0;top:0;width:1920px;height:1080px}
#scr{position:absolute;left:0;top:0;width:402px;height:874px;transform-origin:0 0;border-radius:52.12px;overflow:hidden;
  background:url(screen_cart.png) 0 0/402px 874px no-repeat;transform:%s}
#glass{mix-blend-mode:normal}
</style></head><body><div id="stage" class="clip" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="1">
<div id="scr"></div><img src="body_hole.png"><img id="glass" src="glass_front.png"></div></body></html>''' % info['css_matrix3d_for_402x874pt_element_at_0_0_origin_0_0'])
    print('RESULT', json.dumps(metrics), flush=True)


if __name__ == '__main__':
    main()
