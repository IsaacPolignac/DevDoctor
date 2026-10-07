"""T2: can the phone screen show an image SEQUENCE (scrolling site baked into a 3D shot)?

usage: <blender-venv>/bin/python tools/tests/seq_screen.py

1. Builds 3 screen textures (1206x2622 sRGB) tools/tests/out/seq/scr_0001..0003.png: clean/screen_blank.png chrome with
   clean/product_3.png scrolled to 900 / 1000 / 1100 pt pasted into the page area (screen y 62..796 pt), sticky nav re-stuck.
2. Sets the Screen image to source='SEQUENCE' (frame_duration 3, frame_start 1, use_auto_refresh) and renders scene frames
   1, 2, 3 (front pose, glass hidden so colours round-trip exactly, 1080p, 12 samples, border crop). Then frame_offset=1
   at scene frame 1 (must show scr_0002).
3. Proves it with pixels: mean abs diff (levels /255) of the rendered screen area against each expected texture.
"""
import json
import os
import sys
import time

import bpy  # noqa: must be imported before mathutils
import numpy as np
from mathutils import Quaternion, Vector  # noqa: E402
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PRO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(PRO, 'assets', 'iphone', 'tools'))
import render_iphone as R  # noqa: E402

OUT = os.path.join(HERE, 'out', 'seq')
os.makedirs(OUT, exist_ok=True)
CLEAN = os.path.join(PRO, 'assets', 'site', 'clean')
SCROLLS = [900, 1000, 1100]          # page pt
TOP, SAFARI = 62, 796                # screen pt: page viewport under the status bar, Safari bar top
NAV_Y, NAV_H = 46, 71


def build_textures():
    blank = Image.open(os.path.join(CLEAN, 'screen_blank.png')).convert('RGB')
    page = Image.open(os.path.join(CLEAN, 'product_3.png')).convert('RGB')
    paths = []
    for i, s in enumerate(SCROLLS):
        im = blank.copy()
        h_px = (SAFARI - TOP) * 3
        crop = page.crop((0, s * 3, 1206, s * 3 + h_px))
        im.paste(crop, (0, TOP * 3))
        if s >= NAV_Y:  # sticky header re-stuck at the top of the viewport
            nav = page.crop((0, NAV_Y * 3, 1206, (NAV_Y + NAV_H) * 3))
            im.paste(nav, (0, TOP * 3))
        p = os.path.join(OUT, 'scr_%04d.png' % (i + 1))
        im.save(p)
        paths.append(p)
    return paths


def expected_region(tex_path, rect):
    """the texture as a browser would place it in the 1080p screen rect (same code path as the cutcheck)."""
    return R.place_content(dict(rect, radius_cover=rect['radius_cover']), tex_path)


def main():
    paths = build_textures()
    scene, root = R.load()
    R.set_pose(root, Vector((0, 0, 0)), Quaternion())
    scene.render.resolution_percentage = 100
    scene.render.use_motion_blur = False
    scene.cycles.samples = 12
    bpy.data.objects['GlassScreen'].hide_render = True     # exact colours (as colortest)
    R.set_border(scene, root, margin=0.01)
    # --- the sequence
    img = bpy.data.images.load(paths[0])
    img.source = 'SEQUENCE'
    img.colorspace_settings.name = 'sRGB'
    node = bpy.data.materials['Screen'].node_tree.nodes['ScreenImage']
    node.image = img
    iu = node.image_user
    iu.frame_duration = len(paths)
    iu.frame_start = 1          # scene frame at which scr_0001 shows
    iu.frame_offset = 0
    iu.use_auto_refresh = True
    iu.use_cyclic = False
    print('image source', img.source, 'frame_duration', iu.frame_duration, flush=True)
    rect = json.load(open(os.path.join(PRO, 'assets', 'iphone', 'screen_rect.json')))['1920x1080']['screen']
    exp = [expected_region(p, rect) for p in paths]
    x0, y0 = int(rect['x'] + 8), int(rect['y'] + 140)       # below the status bar / island
    x1, y1 = int(rect['x'] + rect['w'] - 8), int(rect['y'] + rect['h'] - 8)
    cases = [(1, 0, 1), (2, 0, 2), (3, 0, 3), (1, 1, 2)]     # (scene frame, frame_offset, expected texture number)
    matrix = []
    times = []
    for f, off, want in cases:
        iu.frame_offset = off
        scene.frame_set(f)
        name = 'seq_f%d_off%d.png' % (f, off)
        t0 = time.time()
        R.render_to(scene, os.path.join(OUT, name))
        times.append(time.time() - t0)
        got = R.read_png(os.path.join(OUT, name))[y0:y1, x0:x1, :3]
        row = []
        for k in range(len(paths)):
            d = np.abs(got - exp[k][y0:y1, x0:x1, :3]).mean() * 255
            row.append(round(float(d), 2))
        ok = int(np.argmin(row)) + 1 == want and row[want - 1] < 4.0
        matrix.append({'scene_frame': f, 'frame_offset': off, 'expected_texture': want, 'mean_abs_diff_vs_tex_1_2_3': row,
                       'pass': bool(ok), 'render_s': round(times[-1], 1)})
        print('SEQ frame %d offset %d -> diff vs tex1/2/3 = %s  expected tex %d  %s' % (f, off, row, want, 'PASS' if ok else 'FAIL'),
              flush=True)
    res = {'image_source': img.source, 'frame_duration': iu.frame_duration, 'cases': matrix,
           'all_pass': all(c['pass'] for c in matrix), 'avg_render_s': round(sum(times) / len(times), 2)}
    json.dump(res, open(os.path.join(OUT, 'seq_result.json'), 'w'), indent=1)
    # contact sheet of the 3 rendered screens (cropped to the phone) for the report
    tiles = []
    for f, off, want in cases[:3]:
        im = Image.open(os.path.join(OUT, 'seq_f%d_off%d.png' % (f, off))).convert('RGBA')
        bg = Image.new('RGBA', im.size, (233, 237, 243, 255))
        bg.alpha_composite(im)
        tiles.append(bg.crop((730, 80, 1190, 1000)).convert('RGB'))
    sheet = Image.new('RGB', (460 * 3, 920), (20, 22, 26))
    for i, t in enumerate(tiles):
        sheet.paste(t, (460 * i, 0))
    sheet.save(os.path.join(OUT, 'seq_contact.png'))
    print('RESULT', json.dumps(res), flush=True)


if __name__ == '__main__':
    main()
