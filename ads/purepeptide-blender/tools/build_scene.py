"""Build the PurePeptide vial studio scene -> scene.blend (deterministic).

Run:  .venv/bin/python tools/build_scene.py
Units: metres. Vial axis = world Z, glass foot on the floor (z = 0), label front faces -Y.
"""
import math
import os
import random

import bpy  # noqa: must be imported before bmesh/mathutils
import bmesh
from mathutils import Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MM = 0.001
LIFT = 0.00005  # 0.05 mm clearance above the floor


# ----------------------------------------------------------------------------- helpers
def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)


def rounded_polyline(pts, closed=False, arc_steps=10):
    """pts: list of (r, z, radius). Replace each corner with a tangent arc of given radius."""
    out = []
    n = len(pts)
    for i, (x, y, rad) in enumerate(pts):
        first_or_last = (not closed) and (i == 0 or i == n - 1)
        if rad <= 0 or first_or_last:
            out.append((x, y))
            continue
        p = Vector((x, y))
        a = Vector(pts[i - 1][:2])
        b = Vector(pts[(i + 1) % n][:2])
        da = (a - p).normalized()
        db = (b - p).normalized()
        ang = da.angle(db)
        if ang < 1e-4 or abs(ang - math.pi) < 1e-4:
            out.append((x, y))
            continue
        t = rad / math.tan(ang / 2)
        t = min(t, (a - p).length * 0.49, (b - p).length * 0.49)
        rad_eff = t * math.tan(ang / 2)
        p1 = p + da * t
        p2 = p + db * t
        bis = (da + db).normalized()
        c = p + bis * (rad_eff / math.sin(ang / 2))
        a1 = math.atan2(p1.y - c.y, p1.x - c.x)
        a2 = math.atan2(p2.y - c.y, p2.x - c.x)
        d = a2 - a1
        while d > math.pi:
            d -= 2 * math.pi
        while d < -math.pi:
            d += 2 * math.pi
        for k in range(arc_steps + 1):
            aa = a1 + d * k / arc_steps
            out.append((c.x + rad_eff * math.cos(aa), c.y + rad_eff * math.sin(aa)))
    return out


def densify(pts2d, max_len):
    out = []
    for i in range(len(pts2d) - 1):
        a, b = Vector(pts2d[i]), Vector(pts2d[i + 1])
        n = max(1, int(math.ceil((b - a).length / max_len)))
        for k in range(n):
            out.append(tuple(a.lerp(b, k / n)))
    out.append(pts2d[-1])
    return out


def revolve(name, profile_mm, steps, closed_loop=False):
    """profile_mm: list of (r, z) in mm, open polyline from axis to axis (or closed loop)."""
    bm = bmesh.new()
    verts = [bm.verts.new((r * MM, 0.0, z * MM)) for r, z in profile_mm]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    if closed_loop:
        edges.append(bm.edges.new((verts[-1], verts[0])))
    geom = verts + edges
    bmesh.ops.spin(bm, geom=geom, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=steps,
                   use_merge=True, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def node(nt, typ, loc=(0, 0), **inputs):
    n = nt.nodes.new(typ)
    n.location = loc
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = node(nt, 'ShaderNodeOutputMaterial', (600, 0))
    return m, nt, out


# ----------------------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = 'PurePeptide'
random.seed(1234)
noise.seed_set(1234) if hasattr(noise, 'seed_set') else None

# ----------------------------------------------------------------------------- materials
# Glass: clear borosilicate, IOR 1.52, faint blue-green absorption in the volume.
glass, nt, out = new_mat('Glass')
bsdf = node(nt, 'ShaderNodeBsdfPrincipled', (-300, 100))
bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
bsdf.inputs['Transmission Weight'].default_value = 1.0
bsdf.inputs['IOR'].default_value = 1.52
bsdf.inputs['Roughness'].default_value = 0.0
# shadow rays pass through glass (lightly tinted) so the powder/stopper inside get light
# without needing refractive caustics.
lp = node(nt, 'ShaderNodeLightPath', (-300, 400))
transp = node(nt, 'ShaderNodeBsdfTransparent', (-300, -200))
transp.inputs['Color'].default_value = (0.90, 0.95, 0.94, 1)
mix = node(nt, 'ShaderNodeMixShader', (200, 100))
nt.links.new(lp.outputs['Is Shadow Ray'], mix.inputs['Fac'])
nt.links.new(bsdf.outputs['BSDF'], mix.inputs[1])
nt.links.new(transp.outputs['BSDF'], mix.inputs[2])
nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
vol = node(nt, 'ShaderNodeVolumeAbsorption', (200, -200))
vol.inputs['Color'].default_value = (0.80, 0.93, 0.90, 1)
vol.inputs['Density'].default_value = 60.0  # per metre -> ~1.5% per mm, stronger through edges
nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])

# Lyophilised cake: off-white, rough, a little subsurface.
cake, nt, out = new_mat('PowderCake')
b = node(nt, 'ShaderNodeBsdfPrincipled', (0, 0))
b.inputs['Base Color'].default_value = (0.86, 0.85, 0.82, 1)
b.inputs['Roughness'].default_value = 0.92
b.inputs['Subsurface Weight'].default_value = 0.35
b.inputs['Subsurface Radius'].default_value = (1.0, 0.9, 0.8)
b.inputs['Subsurface Scale'].default_value = 0.0006
tc = node(nt, 'ShaderNodeTexCoord', (-900, 0))
nz = node(nt, 'ShaderNodeTexNoise', (-650, 0))
nz.inputs['Scale'].default_value = 900.0
nz.inputs['Detail'].default_value = 8.0
nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
bump = node(nt, 'ShaderNodeBump', (-300, -200))
bump.inputs['Strength'].default_value = 0.6
bump.inputs['Distance'].default_value = 0.00015
nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])

# Grey bromobutyl stopper.
rub, nt, out = new_mat('Rubber')
b = node(nt, 'ShaderNodeBsdfPrincipled')
b.inputs['Base Color'].default_value = (0.045, 0.047, 0.05, 1)
b.inputs['Roughness'].default_value = 0.55
nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])

# Aluminium crimp: brushed (anisotropic around the axis) + fine lathe noise.
alu, nt, out = new_mat('Aluminium')
b = node(nt, 'ShaderNodeBsdfPrincipled', (0, 0))
b.inputs['Base Color'].default_value = (0.86, 0.87, 0.88, 1)
b.inputs['Metallic'].default_value = 1.0
b.inputs['Roughness'].default_value = 0.22
b.inputs['Anisotropic'].default_value = 0.75
tang = node(nt, 'ShaderNodeTangent', (-300, -300))
tang.direction_type = 'RADIAL'
tang.axis = 'Z'
nt.links.new(tang.outputs['Tangent'], b.inputs['Tangent'])
tc = node(nt, 'ShaderNodeTexCoord', (-1000, 0))
sep = node(nt, 'ShaderNodeSeparateXYZ', (-800, 0))
nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
nz = node(nt, 'ShaderNodeTexNoise', (-600, 0))
nz.noise_dimensions = '1D'
nz.inputs['Scale'].default_value = 4000.0
nz.inputs['Detail'].default_value = 4.0
nt.links.new(sep.outputs['Z'], nz.inputs['W'])
bump = node(nt, 'ShaderNodeBump', (-300, 0))
bump.inputs['Strength'].default_value = 0.08
bump.inputs['Distance'].default_value = 0.00003
nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])

# Blue flip-off cap: satin polypropylene, brand blue #1F4FD1.
capm, nt, out = new_mat('CapBlue')
b = node(nt, 'ShaderNodeBsdfPrincipled', (0, 0))
b.inputs['Base Color'].default_value = srgb('#1F4FD1')
b.inputs['Roughness'].default_value = 0.42
b.inputs['Specular IOR Level'].default_value = 0.35
b.inputs['Subsurface Weight'].default_value = 0.08
b.inputs['Subsurface Radius'].default_value = (0.2, 0.4, 1.0)
b.inputs['Subsurface Scale'].default_value = 0.0005
tc = node(nt, 'ShaderNodeTexCoord', (-900, 0))
nz = node(nt, 'ShaderNodeTexNoise', (-650, 0))
nz.inputs['Scale'].default_value = 2500.0
nz.inputs['Detail'].default_value = 3.0
nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
bump = node(nt, 'ShaderNodeBump', (-300, -200))
bump.inputs['Strength'].default_value = 0.05
bump.inputs['Distance'].default_value = 0.00002
nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])

# Label paper (semi-gloss coated stock).
labm, nt, out = new_mat('Label')
b = node(nt, 'ShaderNodeBsdfPrincipled', (0, 0))
b.inputs['Roughness'].default_value = 0.42
b.inputs['Specular IOR Level'].default_value = 0.45
b.inputs['Coat Weight'].default_value = 0.12
b.inputs['Coat Roughness'].default_value = 0.18
img = node(nt, 'ShaderNodeTexImage', (-500, 100))
img.image = bpy.data.images.load(os.path.join(ROOT, 'assets', 'label.png'))
img.image.colorspace_settings.name = 'sRGB'
img.interpolation = 'Cubic'
img.extension = 'CLIP'
uv = node(nt, 'ShaderNodeUVMap', (-800, 100))
nt.links.new(uv.outputs['UV'], img.inputs['Vector'])
nt.links.new(img.outputs['Color'], b.inputs['Base Color'])
tc = node(nt, 'ShaderNodeTexCoord', (-900, -300))
nz = node(nt, 'ShaderNodeTexNoise', (-650, -300))
nz.inputs['Scale'].default_value = 6000.0
nz.inputs['Detail'].default_value = 6.0
nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
bump = node(nt, 'ShaderNodeBump', (-300, -300))
bump.inputs['Strength'].default_value = 0.06
bump.inputs['Distance'].default_value = 0.00002
nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])

# Label back side (adhesive side seen through the glass): plain paper, no print.
labback, nt, out = new_mat('LabelBack')
b = node(nt, 'ShaderNodeBsdfPrincipled')
b.inputs['Base Color'].default_value = (0.78, 0.79, 0.79, 1)
b.inputs['Roughness'].default_value = 0.6
nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])

# Black acrylic floor: dark glossy, roughness grows with distance -> reflection fades out.
flm, nt, out = new_mat('Floor')
b = node(nt, 'ShaderNodeBsdfPrincipled', (0, 0))
b.inputs['Base Color'].default_value = (0.004, 0.004, 0.0045, 1)
b.inputs['Specular IOR Level'].default_value = 0.5
b.inputs['IOR'].default_value = 1.49
tc = node(nt, 'ShaderNodeTexCoord', (-1000, 0))
ln = node(nt, 'ShaderNodeVectorMath', (-800, 0))
ln.operation = 'LENGTH'
nt.links.new(tc.outputs['Object'], ln.inputs[0])
mr = node(nt, 'ShaderNodeMapRange', (-550, 0))
mr.inputs['From Min'].default_value = 0.02
mr.inputs['From Max'].default_value = 0.25
mr.inputs['To Min'].default_value = 0.05
mr.inputs['To Max'].default_value = 0.35
nt.links.new(ln.outputs['Value'], mr.inputs['Value'])
nt.links.new(mr.outputs['Result'], b.inputs['Roughness'])
nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])

# ----------------------------------------------------------------------------- geometry
root = bpy.data.objects.new('Vial', None)
scene.collection.objects.link(root)
root.location = (0, 0, LIFT)

# Glass: closed profile, outer surface then inner surface (1 mm wall), axis to axis.
glass_prof = [
    (0.0, 1.40, 0), (8.5, 0.0, 3.0), (12.0, 0.0, 1.8), (12.0, 36.0, 4.2), (8.0, 40.6, 1.4),
    (8.0, 43.9, 0.3), (10.0, 44.5, 0.6), (10.0, 50.0, 1.1), (6.3, 50.0, 0.35),
    (6.3, 40.4, 1.2), (11.0, 35.6, 3.4), (11.0, 1.30, 1.3), (8.5, 1.35, 2.5), (0.0, 2.75, 0),
]
p = densify(rounded_polyline(glass_prof, arc_steps=12), 0.8)
g = revolve('Glass', p, 192)
g.data.materials.append(glass)
g.parent = root

# Powder cake (sits on the inner push-up, shrunk 0.12 mm from the wall, rough top).
cake_prof = [(0.0, 2.79, 0), (8.5, 1.40, 2.4), (10.85, 1.40, 0.9), (10.85, 8.6, 0.8), (0.0, 8.9, 0)]
p = densify(rounded_polyline(cake_prof, arc_steps=8), 0.25)
ck = revolve('PowderCake', p, 160)
me = ck.data
for v in me.vertices:
    x, y, z = v.co
    r = math.hypot(x, y)
    if z > 7.4 * MM:
        w = min(1.0, (z - 7.4 * MM) / (1.0 * MM))
        q = Vector((x, y, 0)) * 900.0
        n1 = noise.noise(q + Vector((3.1, 7.7, 0.0)))
        n2 = noise.noise(q * 3.2 + Vector((11.0, 2.0, 5.0)))
        dish = -0.35 * MM * (1 - (r / (10.9 * MM)) ** 2)  # slight concave centre
        v.co.z += w * (0.32 * MM * n1 + 0.10 * MM * n2 + dish)
    elif r > 10.0 * MM and z > 1.6 * MM:  # slightly irregular side
        q = Vector((x, y, z)) * 1400.0
        s = 1 + 0.008 * noise.noise(q)
        v.co.x *= s
        v.co.y *= s
ck.data.materials.append(cake)
ck.parent = root

# Stopper: plug in the neck + flange on top of the lip.
stop_prof = [(0.0, 41.6, 0), (6.15, 41.6, 0.8), (6.15, 49.9, 0.2), (9.8, 50.05, 0.4),
             (9.8, 52.2, 0.4), (0.0, 52.2, 0)]
p = densify(rounded_polyline(stop_prof, arc_steps=6), 0.8)
st = revolve('Stopper', p, 128)
st.data.materials.append(rub)
st.parent = root

# Aluminium crimp: 0.2 mm sheet, rolled under the lip, open centre under the flip-off cap.
crimp_prof = [(8.55, 43.55, 0), (10.28, 44.05, 0.45), (10.28, 52.45, 0.55), (7.2, 52.55, 0.15),
              (7.2, 52.35, 0.1), (10.08, 52.25, 0.35), (10.08, 44.2, 0.3), (8.55, 43.75, 0)]
p = densify(rounded_polyline(crimp_prof, closed=True, arc_steps=8), 0.5)
cr = revolve('Crimp', p, 480, closed_loop=True)
for v in cr.data.vertices:  # slight vertical ribs on the skirt (60 around)
    x, y, z = v.co
    r = math.hypot(x, y)
    if r > 10.2 * MM and 44.8 * MM < z < 51.6 * MM:
        a = math.atan2(y, x)
        k = 1 + (0.035 * MM / r) * (0.5 + 0.5 * math.cos(60 * a)) ** 3
        v.co.x *= k
        v.co.y *= k
cr.data.materials.append(alu)
cr.parent = root

# Flip-off cap with a small circular ridge on top.
cap_prof = [(0.0, 52.6, 0), (9.6, 52.6, 0.2), (9.6, 53.3, 0.2), (10.55, 53.3, 0.25), (10.55, 57.0, 0.9),
            (8.2, 57.0, 0.15), (8.0, 57.22, 0.12), (7.4, 57.22, 0.12), (7.2, 56.95, 0.15),
            (0.0, 56.85, 0)]
p = densify(rounded_polyline(cap_prof, arc_steps=8), 0.4)
cp = revolve('Cap', p, 256)
cp.data.materials.append(capm)
cp.parent = root

# Label: 330 deg wrap, 23.5 mm tall, 0.1 mm off the glass, 0.08 mm thick paper. Front = -Y.
R_LAB, Z0, Z1, WRAP = 12.10 * MM, 6.2 * MM, 29.7 * MM, math.radians(330)
NU, NV = 330, 8
bm = bmesh.new()
uvl = bm.loops.layers.uv.new('UVMap')
grid = []
for j in range(NV + 1):
    row = []
    for i in range(NU + 1):
        u = i / NU
        a = -math.pi / 2 + (u - 0.5) * WRAP  # u=0.5 -> angle -90deg (-Y)
        row.append(bm.verts.new((R_LAB * math.cos(a), R_LAB * math.sin(a), Z0 + (Z1 - Z0) * j / NV)))
    grid.append(row)
for j in range(NV):
    for i in range(NU):
        f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        for loop, (uu, vv) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
            loop[uvl].uv = (uu / NU, vv / NV)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new('Label')
bm.to_mesh(me)
bm.free()
for poly in me.polygons:
    poly.use_smooth = True
lab = bpy.data.objects.new('Label', me)
scene.collection.objects.link(lab)
# make sure normals face outward
if me.polygons[0].normal.dot(Vector(me.polygons[0].center).normalized()) < 0:
    me.flip_normals()
sol = lab.modifiers.new('paper', 'SOLIDIFY')
sol.thickness = 0.08 * MM
sol.offset = 1.0
sol.material_offset = 1  # inner (adhesive) side + rim -> plain paper back
sol.material_offset_rim = 1
lab.data.materials.append(labm)
lab.data.materials.append(labback)
lab.parent = root

# Floor
bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = 'Floor'
floor.data.materials.append(flm)

# ----------------------------------------------------------------------------- world
world = bpy.data.worlds.new('Black')
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0, 0, 0, 1)
bg.inputs['Strength'].default_value = 0.0
scene.world = world


# ----------------------------------------------------------------------------- lights
def area(name, loc, size, size_y, energy, shape='RECTANGLE', color=(1, 1, 1), target=(0, 0, 0.025)):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = shape
    ld.size = size
    ld.size_y = size_y
    ld.energy = energy
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    ob.visible_camera = False
    return ob


# big soft rim/key from behind-left
key = area('Key_Rim', (-0.30, 0.38, 0.16), 0.45, 0.45, 20.0, color=(1.0, 0.98, 0.96))
# tall thin strips left / right, slightly behind the vial: long vertical speculars + refracted edges
sl = area('Strip_L', (-0.20, 0.07, 0.05), 0.025, 0.55, 10.0, color=(0.96, 0.98, 1.0))
sr = area('Strip_R', (0.20, 0.09, 0.05), 0.025, 0.55, 10.0, color=(1.0, 0.99, 0.97))
# soft top light
top = area('Top', (0.0, 0.02, 0.32), 0.30, 0.30, 3.0, shape='DISK', target=(0, 0, 0))
# faint large front fill so the label reads (kept very low: product-film contrast)
fill = area('Fill', (0.16, -0.50, 0.34), 0.3, 0.3, 8.0, color=(1.0, 1.0, 1.0))

# large soft white card seen only by the metal crimp + cap (silver gradient on the aluminium)
card = area('Card', (-0.10, -0.22, 0.16), 0.35, 0.20, 6.0, target=(0, 0, 0.048))
card_coll = bpy.data.collections.new('LL_CapCrimp')
card.light_linking.receiver_collection = card_coll

# light linking: studio lights do not light / reflect in the floor, so the black acrylic only
# mirrors the vial itself (no bright floor hotspots).
floor_coll = bpy.data.collections.new('LL_NoFloor')
for ob in (key, sl, sr, top, fill):
    ob.light_linking.receiver_collection = floor_coll
    ob.light_linking.blocker_collection = None
FLOOR_LL = floor_coll
# strips: specular-only (long highlights on glass/metal/cap, no diffuse blow-out on the label)
for ob in (sl, sr):
    ob.visible_diffuse = False
# fill: lights the label diffusely but never shows up as a reflection in the glass
fill.visible_glossy = False
fill.visible_transmission = False

# ----------------------------------------------------------------------------- camera
cam_d = bpy.data.cameras.new('Camera')
cam_d.lens = 85
cam_d.sensor_width = 36
cam_d.clip_start = 0.005
cam_d.clip_end = 20
cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 8.0
cam = bpy.data.objects.new('Camera', cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (0.0, -0.36, 0.05)
cam.rotation_euler = (Vector((0, 0, 0.027)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam_d.dof.focus_distance = (Vector((0, 0, 0.027)) - cam.location).length

# optional haze (off by default: costly on CPU)
haze = bpy.data.materials.new('Haze')
haze.use_nodes = True
hn = haze.node_tree
for n in list(hn.nodes):
    hn.nodes.remove(n)
ho = hn.nodes.new('ShaderNodeOutputMaterial')
hv = hn.nodes.new('ShaderNodeVolumePrincipled')
hv.inputs['Density'].default_value = 0.4
hn.links.new(hv.outputs['Volume'], ho.inputs['Volume'])
bpy.ops.mesh.primitive_cube_add(size=1.2, location=(0, 0, 0.6))
hb = bpy.context.active_object
hb.name = 'Haze'
hb.data.materials.append(haze)
hb.hide_render = True
hb.hide_viewport = True

for n in ('Crimp',):
    card_coll.objects.link(bpy.data.objects[n])
FLOOR_LL.objects.link(floor)
for cobj in FLOOR_LL.collection_objects:
    cobj.light_linking.link_state = 'EXCLUDE'

# ----------------------------------------------------------------------------- render settings
r = scene.render
r.engine = 'CYCLES'
r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
r.fps = 30
r.film_transparent = False
r.use_persistent_data = True
r.image_settings.file_format = 'PNG'
r.image_settings.color_depth = '16'
r.image_settings.color_mode = 'RGB'
c = scene.cycles
c.device = 'CPU'
c.samples = 96
c.use_adaptive_sampling = True
c.adaptive_threshold = 0.02
c.adaptive_min_samples = 16
c.use_denoising = True
c.denoiser = 'OPENIMAGEDENOISE'
c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
c.denoising_prefilter = 'ACCURATE'
c.max_bounces = 16
c.diffuse_bounces = 3
c.glossy_bounces = 6
c.transmission_bounces = 14
c.transparent_max_bounces = 16
c.volume_bounces = 0
c.caustics_reflective = False
c.caustics_refractive = False
c.sample_clamp_direct = 0.0
c.sample_clamp_indirect = 10.0
c.blur_glossy = 0.3
c.seed = 7
c.use_animated_seed = False
c.volume_step_rate = 4.0
r.threads_mode = 'FIXED'
r.threads = 4
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.0
scene.display_settings.display_device = 'sRGB'

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'scene.blend'), compress=True)
print('saved scene.blend; look =', scene.view_settings.look)
