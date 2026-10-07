"""Probe for the cards' shadows on the screen plane (why is the Shadow Catcher pass ~1?):
A) Screen as a plain white diffuse plane, cards + dedicated key only -> combined image shows the real shadows.
B) Screen as shadow catcher -> Shadow Catcher pass.  720p, 16 samples."""
import os, sys, json
import bpy
import numpy as np
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'assets', 'iphone', 'tools'))
import render_iphone as R
import cards_passes as C
OUT = os.path.join(HERE, 'out', 'shadow_probe'); os.makedirs(OUT, exist_ok=True)
C.OUT = OUT
scene, root = R.load()
R.set_screen(os.path.join(C.CLEAN, 'screen_cart.png'))
spin, tilt, roll, loc = C.POSE
R.set_pose(root, loc, R.compose(spin, tilt, roll))
cards = [C.make_card(*c) for c in C.CARDS]
for o in R.PHONE_PARTS:
    o.hide_render = o.name != 'Screen'
for o in bpy.data.objects:
    if o.type == 'LIGHT' or o.name.startswith('Soft') or o.name.startswith('Side') or o.name == 'SheenCard':
        o.hide_render = True
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
ld = bpy.data.lights.new('ShadowKey', 'AREA'); ld.shape = 'SQUARE'; ld.size = 0.12; ld.energy = 60.0
lo = bpy.data.objects.new('ShadowKey', ld); scene.collection.objects.link(lo)
lo.location = (-0.35, -0.55, 0.45)
lo.rotation_euler = (Vector((0, 0, 0)) - Vector(lo.location)).to_track_quat('-Z', 'Y').to_euler()
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1280, 720, 100
scene.render.use_border = False
scene.cycles.samples = 16
scene.render.use_compositing = False
scr = bpy.data.objects['Screen']
# A) white diffuse screen
m = bpy.data.materials.new('ProbeWhite'); m.use_nodes = True
m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
orig = scr.data.materials[0]; scr.data.materials[0] = m
R.render_to(scene, os.path.join(OUT, 'A_white_diffuse.png'))
a = R.read_png(os.path.join(OUT, 'A_white_diffuse.png'))
print('A: screen pixel value range (alpha>0.5):', round(float(a[a[..., 3] > 0.5][..., 0].min()), 3), round(float(a[a[..., 3] > 0.5][..., 0].max()), 3))
# B) shadow catcher pass
scr.data.materials[0] = orig
scr.is_shadow_catcher = True
scene.view_layers[0].cycles.use_pass_shadow_catcher = True
scene.view_layers[0].use_pass_z = True
scene.view_layers[0].use_pass_object_index = True
scene.view_layers[0].use_pass_cryptomatte_object = True
C.set_format  # noqa
C.setup_compositor(scene, OUT, 0.6, 0.9, with_shadow=True, prefix='probe_')
R.render_to(scene, os.path.join(OUT, '_probe_composite.png'))
import glob
sc = sorted(glob.glob(os.path.join(OUT, 'probe_shadow_catcher*.png')))[-1]
b = R.read_png(sc)[..., 0]
print('B: shadow catcher pass min %.3f, px < 0.9: %d' % (b.min(), (b < 0.9).sum()))
c = R.read_png(os.path.join(OUT, '_probe_composite.png'))
print('B combined: alpha>0.5 px %d (catcher should be transparent except the cards)' % (c[..., 3] > 0.5).sum())
os.replace(sc, os.path.join(OUT, 'B_shadow_catcher.png'))
