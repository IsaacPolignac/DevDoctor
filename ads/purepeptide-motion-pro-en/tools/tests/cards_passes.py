"""T3 + T4: UI cards as thin extruded (bevelled) planes textured with the clean capture crops, floating in front of the
tilted phone screen, camera DOF; and the compositing passes: RGBA, Z (EXR float + preview), object-index mattes
(phone / cards / screen, anti-aliased), Cryptomatte (multilayer EXR, channel list verified), and a Shadow Catcher pass of
the cards' soft shadows on the screen plane (multiplied onto the screen content afterwards).

usage: <blender-venv>/bin/python tools/tests/cards_passes.py
outputs: tools/tests/out/cards/  cards_rgba.png, cards_test.png (over a light bg), cards_shadowed.png, matte_*.png,
         depth.exr, depth_preview.png, shadow_catcher.png, cards_multilayer.exr, cards_sheet.png, cards_result.json
"""
import json
import math
import os
import struct
import sys
import time

import bpy  # noqa: must be imported before bmesh/mathutils
import bmesh  # noqa: E402
import numpy as np
from mathutils import Euler, Vector  # noqa: E402
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PRO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(PRO, 'assets', 'iphone', 'tools'))
import render_iphone as R  # noqa: E402

OUT = os.path.join(HERE, 'out', 'cards')
os.makedirs(OUT, exist_ok=True)
CLEAN = os.path.join(PRO, 'assets', 'site', 'clean')
MM = 0.001
PT_MM = 66.6 / 402.0            # one screen point in mm on the display
# the tilted pose shared with homography.py (spin, tilt, roll deg, location m)
POSE = (14.0, -5.0, -2.0, Vector((0.012, 0.030, 0.0)))
# cards: (name, capture, page-pt rect, corner radius pt, world centre (m), euler deg)
# world y of the display plane in this pose is ~ +0.0257 m (root y 0.030, screen 4.3 mm in front); the cards float
# 16..28 mm in front of it (85 mm lens at 0.76 m: f/8 keeps both the phone and the cards readable)
CARDS = [
    ('ship', 'cart3', (20, 240.88, 362, 76.8), 16, (-0.052, 0.0037, 0.046), (6, -8, 2)),
    ('bundle', 'product_3', (20, 1235.81, 362, 66), 16, (0.040, 0.0097, -0.002), (-4, 10, -1)),
    ('addcart', 'product_3', (20, 1443, 362, 52), 26, (-0.022, -0.0023, -0.047), (8, -6, 1)),
]


def rounded_rect(w, h, r, seg=24):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    # drop duplicates where arcs meet straight edges of zero length
    out = []
    for p in pts:
        if not out or (abs(p[0] - out[-1][0]) > 1e-9 or abs(p[1] - out[-1][1]) > 1e-9):
            out.append(p)
    if abs(out[0][0] - out[-1][0]) < 1e-9 and abs(out[0][1] - out[-1][1]) < 1e-9:
        out.pop()
    return out


def card_material(name, img_path):
    m = bpy.data.materials.new('Card_' + name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(img_path)
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
    mix.inputs['Fac'].default_value = 0.30      # 70 % emission (exact UI colours) + 30 % lit coat
    nt.links.new(em.outputs[0], mix.inputs[1])
    nt.links.new(pr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    m.cycles.emission_sampling = 'NONE'
    return m


def edge_material():
    m = bpy.data.materials.new('CardEdge')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.86, 0.88, 0.91, 1)
    b.inputs['Roughness'].default_value = 0.22
    b.inputs['Coat Weight'].default_value = 0.5
    return m


def make_card(name, capture, rect, radius, centre, rot_deg, thickness_mm=1.0, bevel_mm=0.35, scale=1.08):
    x, y, w, h = rect
    src = Image.open(os.path.join(CLEAN, capture + '.png')).convert('RGB')
    crop = src.crop((round(x * 3), round(y * 3), round((x + w) * 3), round((y + h) * 3)))
    img_path = os.path.join(OUT, 'crop_%s.png' % name)
    crop.save(img_path)
    W, H = w * PT_MM * scale, h * PT_MM * scale
    rr = min(radius * PT_MM * scale, H / 2 - 1e-6)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    verts = [bm.verts.new((px * MM, py * MM, 0.0)) for px, py in rounded_rect(W, H, rr)]
    back = bm.faces.new(verts)
    res = bmesh.ops.extrude_face_region(bm, geom=[back])
    new_verts = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=new_verts, vec=(0, 0, thickness_mm * MM))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        front = f.normal.z > 0.9
        f.material_index = 0 if front else 1
        f.smooth = not (front or f.normal.z < -0.9)
        for lp in f.loops:
            lp[uvl].uv = ((lp.vert.co.x / MM + W / 2) / W, (lp.vert.co.y / MM + H / 2) / H)
    me = bpy.data.meshes.new('Card_' + name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(card_material(name, img_path))
    me.materials.append(edge_material())
    ob = bpy.data.objects.new('Card_' + name, me)
    bpy.context.scene.collection.objects.link(ob)
    bev = ob.modifiers.new('Bevel', 'BEVEL')
    bev.width = bevel_mm * MM
    bev.segments = 3
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(40)
    ob.location = centre
    # local +Z (front) -> world -Y (towards the camera), local +Y -> world +Z, then the card's own small rotation
    ob.rotation_euler = (Euler((math.radians(90), 0, 0)).to_matrix() @ Euler([math.radians(a) for a in rot_deg]).to_matrix()).to_euler()
    ob.pass_index = 2
    return ob, (W, H)


def exr_channels(path):
    """channel names of an OpenEXR file parsed from its header(s); Blender 5.0 writes one PART per File Output item."""
    with open(path, 'rb') as fh:
        data = fh.read(1 << 21)
    assert data[:4] == b'\x76\x2f\x31\x01', 'not an EXR'
    ver = struct.unpack('<i', data[4:8])[0]
    multipart = bool(ver & 0x1000)
    pos = 8
    chans = []
    while True:
        while True:
            end = data.index(b'\0', pos)
            name = data[pos:end].decode()
            pos = end + 1
            if name == '':
                break
            end = data.index(b'\0', pos)
            typ = data[pos:end].decode()
            pos = end + 1
            size = struct.unpack('<i', data[pos:pos + 4])[0]
            pos += 4
            val = data[pos:pos + size]
            pos += size
            if typ == 'chlist':
                q = 0
                while q < len(val) - 1:
                    e = val.index(b'\0', q)
                    chans.append(val[q:e].decode())
                    q = e + 1 + 16
        if not multipart or data[pos] == 0:
            break
    return chans


def set_format(fmt, file_format, color_mode=None, color_depth=None, codec=None):
    """Blender 5.0: ImageFormatSettings.media_type gates the file_format enum (IMAGE / MULTI_LAYER_IMAGE / VIDEO)."""
    if hasattr(fmt, 'media_type'):
        fmt.media_type = 'MULTI_LAYER_IMAGE' if file_format == 'OPEN_EXR_MULTILAYER' else 'IMAGE'
    fmt.file_format = file_format
    if color_mode:
        fmt.color_mode = color_mode
    if color_depth:
        fmt.color_depth = color_depth
    if codec:
        fmt.exr_codec = codec


def setup_compositor(scene, out_dir, near, far, with_shadow, prefix):
    """Blender 5.0 compositor: scene.compositing_node_group; File Output nodes use file_output_items (no file_slots) and
    write <directory>/<file_name><item>.<ext> for stills. With compositing on, the main render output is the composite
    (Combined only), so the multilayer EXR with all passes is written by a File Output node too."""
    scene.render.use_compositing = True
    scene.use_nodes = True
    ng = bpy.data.node_groups.new('CardsComp_' + prefix, 'CompositorNodeTree')
    scene.compositing_node_group = ng
    rl = ng.nodes.new('CompositorNodeRLayers')
    fo = ng.nodes.new('CompositorNodeOutputFile')
    fo.directory = out_dir
    fo.file_name = prefix
    set_format(fo.format, 'PNG', 'RGBA', '8')
    slots = ['rgba', 'matte_phone', 'matte_cards', 'matte_screen', 'depth_preview'] + (['shadow_catcher'] if with_shadow else [])
    for s in slots:
        fo.file_output_items.new('RGBA' if s == 'rgba' else 'FLOAT', s)
    it = fo.file_output_items.new('FLOAT', 'depth')
    it.override_node_format = True
    set_format(it.format, 'OPEN_EXR', 'RGB', '32', 'ZIP')
    ng.links.new(rl.outputs['Image'], fo.inputs['rgba'])
    ng.links.new(rl.outputs['Depth'], fo.inputs['depth'])
    for i, slot in ((1, 'matte_phone'), (2, 'matte_cards'), (3, 'matte_screen')):
        idm = ng.nodes.new('CompositorNodeIDMask')
        idm.inputs['Index'].default_value = i
        idm.inputs['Anti-Alias'].default_value = True
        ng.links.new(rl.outputs['Object Index'], idm.inputs['ID value'])
        ng.links.new(idm.outputs['Alpha'], fo.inputs[slot])
    mr = ng.nodes.new('ShaderNodeMapRange')
    mr.clamp = True
    ng.links.new(rl.outputs['Depth'], mr.inputs['Value'])
    mr.inputs['From Min'].default_value = near
    mr.inputs['From Max'].default_value = far
    mr.inputs['To Min'].default_value = 1.0
    mr.inputs['To Max'].default_value = 0.0
    ng.links.new(mr.outputs['Result'], fo.inputs['depth_preview'])
    if with_shadow:
        ng.links.new(rl.outputs['Shadow Catcher'], fo.inputs['shadow_catcher'])
    # all passes in one multilayer EXR (Cryptomatte lives here)
    fe = ng.nodes.new('CompositorNodeOutputFile')
    fe.directory = out_dir
    fe.file_name = prefix + 'multilayer'
    set_format(fe.format, 'OPEN_EXR_MULTILAYER', 'RGBA', '16', 'ZIP')
    for name, typ, sock in (('Image', 'RGBA', 'Image'), ('Depth', 'FLOAT', 'Depth'), ('IndexOB', 'FLOAT', 'Object Index'),
                            ('CryptoObject00', 'RGBA', 'CryptoObject00'), ('CryptoObject01', 'RGBA', 'CryptoObject01'),
                            ('CryptoObject02', 'RGBA', 'CryptoObject02')):
        fe.file_output_items.new(typ, name)
        ng.links.new(rl.outputs[sock], fe.inputs[name])


def collect_outputs(out_dir, prefix, names, ext):
    """rename <prefix><name>*.<ext> -> <name>.<ext>; returns what was found."""
    import glob
    found = {}
    for n in names:
        hits = sorted(glob.glob(os.path.join(out_dir, prefix + n + '*.' + ext)))
        if hits:
            dst = os.path.join(out_dir, ('cards_' if n in ('rgba', 'multilayer') else '') + n + '.' + ext)
            os.replace(hits[-1], dst)
            found[n] = dst
    return found


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--fstop', type=float, default=8.0)
    ap.add_argument('--shadow_light', type=float, default=0.12, help='size (m) of the dedicated shadow key')
    ap.add_argument('--focus', default='screen', help='screen | card2')
    ap.add_argument('--suffix', default='')
    args = ap.parse_args()
    global OUT
    OUT = os.path.join(HERE, 'out', 'cards' + args.suffix)
    os.makedirs(OUT, exist_ok=True)
    scene, root = R.load()
    R.set_screen(os.path.join(CLEAN, 'screen_cart.png'))
    spin, tilt, roll, loc = POSE
    R.set_pose(root, loc, R.compose(spin, tilt, roll))
    for o in R.PHONE_PARTS:
        o.pass_index = 1
    bpy.data.objects['Screen'].pass_index = 3
    bpy.data.objects['GlassScreen'].pass_index = 3      # the transparent glass over the display counts as "screen"
    cards = [make_card(*c) for c in CARDS]
    cam = scene.camera
    cam.data.dof.use_dof = True
    if args.focus == 'card2':
        cam.data.dof.focus_object = cards[1][0]
    else:
        cam.data.dof.focus_object = bpy.data.objects['Screen']
    cam.data.dof.aperture_fstop = args.fstop
    cam.data.dof.aperture_blades = 0
    vl = scene.view_layers[0]
    vl.use_pass_z = True
    vl.use_pass_object_index = True
    vl.use_pass_cryptomatte_object = True
    vl.pass_cryptomatte_depth = 6
    vl.cycles.use_pass_shadow_catcher = True
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1920, 1080, 100
    scene.render.use_border = False
    scene.render.use_motion_blur = False
    scene.cycles.samples = 24
    dist = (Vector(cam.location) - root.location).length
    setup_compositor(scene, OUT, dist - 0.14, dist + 0.10, with_shadow=False, prefix='main_')
    bpy.context.view_layer.update()
    t_main = R.render_to(scene, os.path.join(OUT, '_main_composite.png'))
    print('CARDS main render %.1f s' % t_main, flush=True)
    found = collect_outputs(OUT, 'main_', ['rgba', 'matte_phone', 'matte_cards', 'matte_screen', 'depth_preview'], 'png')
    found.update(collect_outputs(OUT, 'main_', ['depth', 'multilayer'], 'exr'))
    print('compositor outputs:', found, flush=True)
    chans = exr_channels(os.path.join(OUT, 'cards_multilayer.exr'))
    crypto = [c for c in chans if 'Crypto' in c]
    print('EXR channels (%d): %s' % (len(chans), ', '.join(chans)), flush=True)

    # --- shadow pass: the Screen plane as a shadow catcher, only the cards cast (everything else hidden); cheap
    for o in R.PHONE_PARTS:
        o.hide_render = o.name != 'Screen'
    scr = bpy.data.objects['Screen']
    scr.is_shadow_catcher = True
    cam.data.dof.use_dof = False
    # the cards' 70 % emission lights the catcher and cancels most of the ratio (pass stayed > 0.92 in the probe):
    # the shadow pass renders them with a plain non-emissive material (shadows only depend on their silhouette)
    m_plain = bpy.data.materials.new('CardPlain')
    m_plain.use_nodes = True
    m_plain.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.2, 0.2, 0.2, 1)
    for ob, _ in cards:
        for i in range(len(ob.data.materials)):
            ob.data.materials[i] = m_plain
    # ... and the catcher itself must not emit: the ratio (own emission + shadowed light) / (own emission + light) is ~1
    # for the emissive Screen material (measured 0.98); a white diffuse stand-in gives the true shadow factor
    m_catch = bpy.data.materials.new('CatcherWhite')
    m_catch.use_nodes = True
    m_catch.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
    scr.data.materials[0] = m_catch
    # the studio rig lights the cards from every side (shadow factor on the screen stayed > 0.98): for a readable soft
    # shadow the pass gets its own key, a 0.5 m soft area light up-left of the camera; the rig lights are off for it
    for o in bpy.data.objects:
        if o.type == 'LIGHT' or o.name.startswith('Soft') or o.name.startswith('Side') or o.name == 'SheenCard':
            o.hide_render = True
    ld = bpy.data.lights.new('ShadowKey', 'AREA')
    ld.shape = 'SQUARE'
    ld.size = args.shadow_light
    ld.energy = 60.0
    lo = bpy.data.objects.new('ShadowKey', ld)
    scene.collection.objects.link(lo)
    lo.location = (-0.35, -0.55, 0.45)
    lo.rotation_euler = (Vector((0, 0, 0)) - Vector(lo.location)).to_track_quat('-Z', 'Y').to_euler()
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0 if 'Background' in scene.world.node_tree.nodes else 1.0
    setup_compositor(scene, OUT, dist - 0.14, dist + 0.10, with_shadow=True, prefix='sh_')
    scene.cycles.samples = 32
    t_sh = R.render_to(scene, os.path.join(OUT, '_shadow_composite.png'))
    print('SHADOW render %.1f s' % t_sh, flush=True)
    import glob
    hits = sorted(glob.glob(os.path.join(OUT, 'sh_shadow_catcher*.png')))
    os.replace(hits[-1], os.path.join(OUT, 'shadow_catcher.png'))
    for p in glob.glob(os.path.join(OUT, 'sh_*')) + glob.glob(os.path.join(OUT, '_*composite.png')):
        os.remove(p)

    # --- composites for the report
    bg = np.array([0.93, 0.95, 0.975])
    rgba = R.read_png(os.path.join(OUT, 'cards_rgba.png'))
    over = rgba[..., :3] * rgba[..., 3:4] + bg * (1 - rgba[..., 3:4])
    R.write_png(os.path.join(OUT, 'cards_test.png'), over, mode='RGB', dither=False)
    # the FLOAT item PNG carries the pass value in RGB *and* alpha (a viewer shows the umbra as transparent): read RGB.
    # The pass is a full-strength control matte (single key, no fill: umbra = 0.0); the comp sets its opacity + softness.
    shadow = R.read_png(os.path.join(OUT, 'shadow_catcher.png'))[..., :3]
    shadow = R.gaussian(shadow, 4.0)
    k = 0.35
    m_scr = R.read_png(os.path.join(OUT, 'matte_screen.png'))[..., :1]
    shaded = rgba.copy()
    shaded[..., :3] = rgba[..., :3] * (1 - m_scr * k * (1 - shadow))   # multiply the shadow inside the screen only
    over2 = shaded[..., :3] * shaded[..., 3:4] + bg * (1 - shaded[..., 3:4])
    R.write_png(os.path.join(OUT, 'cards_shadowed.png'), over2, mode='RGB', dither=False)
    sh_min = float(shadow[m_scr[..., 0] > 0.5].min()) if (m_scr[..., 0] > 0.5).any() else 1.0
    tiles = [('rgba over bg + shadow', 'cards_shadowed.png'), ('matte_phone', 'matte_phone.png'), ('matte_cards', 'matte_cards.png'),
             ('matte_screen', 'matte_screen.png'), ('depth_preview', 'depth_preview.png'), ('shadow_catcher', 'shadow_catcher.png')]
    from PIL import ImageDraw, ImageFont
    tw, th = 640, 360
    sheet = Image.new('RGB', (tw * 3, (th + 30) * 2), (20, 22, 26))
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
    d = ImageDraw.Draw(sheet)
    for i, (label, fn) in enumerate(tiles):
        im = Image.open(os.path.join(OUT, fn)).convert('RGBA')
        b = Image.new('RGBA', im.size, (40, 40, 44, 255))
        b.alpha_composite(im)
        r, c = divmod(i, 3)
        sheet.paste(b.convert('RGB').resize((tw, th), Image.LANCZOS), (c * tw, r * (th + 30)))
        d.text((c * tw + 8, r * (th + 30) + th + 6), label, font=font, fill=(230, 230, 230))
    sheet.save(os.path.join(OUT, 'cards_sheet.png'))
    res = {'main_render_s': round(t_main, 1), 'shadow_render_s': round(t_sh, 1), 'samples_main': 24, 'samples_shadow': 32,
           'dof': 'f/%.1f focus on %s' % (args.fstop, args.focus), 'exr_channels': chans, 'cryptomatte_channels': crypto,
           'shadow_catcher_min_on_screen': round(sh_min, 3),
           'matte_cover_px': {k: int((R.read_png(os.path.join(OUT, k + '.png'))[..., 0] > 0.5).sum()) for k in ('matte_phone', 'matte_cards', 'matte_screen')},
           'cards_mm': {c[0]: [round(v, 1) for v in sz] for c, (ob, sz) in zip(CARDS, cards)}}
    json.dump(res, open(os.path.join(OUT, 'cards_result.json'), 'w'), indent=1)
    print('RESULT', json.dumps(res), flush=True)


if __name__ == '__main__':
    main()
