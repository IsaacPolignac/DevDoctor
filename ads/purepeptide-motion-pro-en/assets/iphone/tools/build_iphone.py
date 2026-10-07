"""Build the photoreal iPhone (17 Pro proportions, Deep Blue anodised aluminium) studio scene -> iphone.blend.

Run:  <venv>/bin/python tools/build_iphone.py          (deterministic, ~5 s)

Units: metres in Blender, every dimension below is written in mm.
Phone-local 2D/3D frame used to author geometry: u = width (left -> right seen from the front),
v = height (up), w = thickness (front glass at +w).  P(u, v, w) maps it to the world FRONT POSE:
screen faces -Y (towards the camera), top = +Z, phone centre at the origin.  Every phone part is a
child of the empty "iPhone"; shots animate only that empty (camera + lights never move), so the
last frame of a fly-in that ends on the identity transform is pixel-identical to the front layers.
"""
import math
import os

import bpy  # noqa: must be imported before bmesh/mathutils
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MM = 0.001

# ----------------------------------------------------------------------------- dimensions (mm)
H, W, T = 150.0, 71.9, 8.75
HT = T / 2                    # 4.375
CORNER_E, CORNER_N = 16.0, 3.0  # superellipse corner (extent, exponent): ~11.3 mm circle-equivalent, G2 joins
SEG_CORNER = 96
RF, RB = 0.90, 1.10           # front / back rim radii (flat sides between)
W_LIP = 4.32                  # frame lip top (glass top is HT: glass sits 0.05 mm proud)
GLASS_D = 1.00                # cover-glass edge inset from the outer outline
DISP_D = 2.63                 # active display inset (black border = 1.63 mm)
W_INK, W_SCREEN, W_ISLAND, W_GLASS = 4.20, 4.30, 4.33, HT
PT = 3 / 460 * 25.4           # one iOS point in mm (460 ppi @3x)
ISL_W, ISL_H, ISL_TOP = 125 * PT, 37 * PT, 14 * PT   # Dynamic Island (iOS 17 Pro geometry)
PLAT_BOTTOM = 32.0            # camera plateau lower edge (v), full width
PLAT_H = 1.70                 # plateau rise above the back
W_BACK = -HT
W_PLAT = W_BACK - PLAT_H      # plateau top
LENSES = [  # name, u, v, inner element radius  (camera sits top-left when seen from the back = +u)
    ('Main', 22.9, 62.2, 4.4),
    ('Ultra', 22.9, 44.4, 3.7),
    ('Tele', 7.6, 53.3, 3.1),
]
FLASH = (-26.9, 62.2)
LIDAR = (-26.9, 44.4)
MIC = (-26.9, 53.3)
# buttons: (name, side, centre v, length, height)
BUTTONS = [
    ('Btn_Action', -1, 75 - 30.5, 8.0, 2.55),
    ('Btn_VolUp', -1, 75 - 46.0, 10.6, 2.55),
    ('Btn_VolDown', -1, 75 - 60.0, 10.6, 2.55),
    ('Btn_Side', 1, 75 - 50.0, 17.2, 2.7),
]
CAMCTRL = (1, -22.0, 19.1, 3.1)


def P(u, v, w):
    return Vector((u * MM, -w * MM, v * MM))


def dirP(u, v, w):
    return Vector((u, -w, v))


# ----------------------------------------------------------------------------- 2D outlines
def resample(dense, seg):
    L = [0.0]
    for i in range(1, len(dense)):
        L.append(L[-1] + math.dist(dense[i - 1], dense[i]))
    out, j = [], 0
    for k in range(seg + 1):
        t = L[-1] * k / seg
        while j < len(L) - 2 and L[j + 1] < t:
            j += 1
        a, b = dense[j], dense[j + 1]
        s = 0.0 if L[j + 1] == L[j] else (t - L[j]) / (L[j + 1] - L[j])
        out.append((a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s))
    return out


def squircle_rect(w, h, E, n, seg):
    """CCW outline of a rectangle whose corners are superellipse quadrants (curvature 0 at the joins)."""
    pts = []
    for (cx, cy), a0 in (((w / 2 - E, h / 2 - E), 0), ((-w / 2 + E, h / 2 - E), 90),
                         ((-w / 2 + E, -h / 2 + E), 180), ((w / 2 - E, -h / 2 + E), 270)):
        dense = []
        for k in range(2001):
            a = math.radians(a0 + 90 * k / 2000)
            c, s = math.cos(a), math.sin(a)
            dense.append((cx + E * math.copysign(abs(c) ** (2 / n), c), cy + E * math.copysign(abs(s) ** (2 / n), s)))
        pts += resample(dense, seg)
    return pts


def stadium(L, Hh, seg=40, cx=0.0, cy=0.0):
    r = Hh / 2
    pts = []
    for k in range(seg + 1):
        a = -math.pi / 2 + math.pi * k / seg
        pts.append((cx + L / 2 - r + r * math.cos(a), cy + r * math.sin(a)))
    for k in range(seg + 1):
        a = math.pi / 2 + math.pi * k / seg
        pts.append((cx - L / 2 + r + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def circle(R, seg):
    return [(R * math.cos(2 * math.pi * k / seg), R * math.sin(2 * math.pi * k / seg)) for k in range(seg)]


def normals_of(pts):
    N = len(pts)
    out = []
    for i in range(N):
        a, b, c = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % N])
        t = (b - a).normalized() + (c - b).normalized()
        t.normalize()
        out.append(Vector((t.y, -t.x)))
    return out


def offset(pts, d):
    nrm = normals_of(pts)
    return [(p[0] - d * n.x, p[1] - d * n.y) for p, n in zip(pts, nrm)]


def fillet(a, p, b, r, steps):
    p, a, b = Vector(p), Vector(a), Vector(b)
    da, db = (a - p).normalized(), (b - p).normalized()
    ang = da.angle(db)
    t = r / math.tan(ang / 2)
    p1, p2 = p + da * t, p + db * t
    c = p + (da + db).normalized() * (r / math.sin(ang / 2))
    a1 = math.atan2(p1.y - c.y, p1.x - c.x)
    a2 = math.atan2(p2.y - c.y, p2.x - c.x)
    d = a2 - a1
    while d > math.pi:
        d -= 2 * math.pi
    while d < -math.pi:
        d += 2 * math.pi
    return [(c.x + r * math.cos(a1 + d * k / steps), c.y + r * math.sin(a1 + d * k / steps)) for k in range(steps + 1)]


def clip_fillet(pts, v_cut, keep_above, r, steps=24):
    """Clip a convex CCW outline by the line v = v_cut and round the two new corners."""
    inside = (lambda p: p[1] >= v_cut) if keep_above else (lambda p: p[1] <= v_cut)
    out = []
    N = len(pts)
    for i in range(N):
        a, b = pts[i], pts[(i + 1) % N]
        if inside(a):
            out.append((a, False))
        if inside(a) != inside(b):
            t = (v_cut - a[1]) / (b[1] - a[1])
            out.append(((a[0] + t * (b[0] - a[0]), v_cut), True))
    res = []
    M = len(out)
    for i, (p, is_cut) in enumerate(out):
        if is_cut:
            res += fillet(out[i - 1][0], p, out[(i + 1) % M][0], r, steps)
        else:
            res.append(p)
    return res


# ----------------------------------------------------------------------------- mesh builders
scene_coll = None


def finish(name, bm, mats, facing=None, closed=False, smooth=True, loc=(0, 0, 0), uv_fn=None):
    if closed:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    elif facing is not None:
        bm.normal_update()
        s = sum(f.normal.dot(facing) * f.calc_area() for f in bm.faces)
        if s < 0:
            for f in bm.faces:
                f.normal_flip()
    if uv_fn:
        uvl = bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            for lp in f.loops:
                lp[uvl].uv = uv_fn(lp.vert.co)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    scene_coll.objects.link(ob)
    ob.location = loc
    ob.parent = ROOT_EMPTY
    return ob


def loft(name, pts, profile, mapper, mats, cap_first=False, cap_last=False, close_profile=False,
         seg_mats=None, facing=None, closed=False, loc=(0, 0, 0), sharp_rings=(), uv_fn=None):
    """Sweep a cross-section `profile` [(d inward offset, h)] along the closed 2D outline `pts`."""
    nrm = normals_of(pts)
    bm = bmesh.new()
    rings = []
    for d, h in profile:
        rings.append([bm.verts.new(mapper(p[0] - d * n.x, p[1] - d * n.y, h)) for p, n in zip(pts, nrm)])
    N = len(pts)
    nseg = len(rings) if close_profile else len(rings) - 1
    for k in range(nseg):
        a, b = rings[k], rings[(k + 1) % len(rings)]
        for i in range(N):
            j = (i + 1) % N
            f = bm.faces.new((a[i], b[i], b[j], a[j]))
            if seg_mats:
                f.material_index = seg_mats[k]
    bm.edges.ensure_lookup_table()

    def mark_ring(ring):
        for i in range(N):
            e = bm.edges.get((ring[i], ring[(i + 1) % N]))
            if e:
                e.smooth = False
    if cap_first:
        f = bm.faces.new(rings[0])
        f.smooth = False
        mark_ring(rings[0])
        if seg_mats:
            f.material_index = seg_mats[0]
    if cap_last:
        f = bm.faces.new(list(reversed(rings[-1])))
        f.smooth = False
        mark_ring(rings[-1])
        if seg_mats:
            f.material_index = seg_mats[-1]
    for k in sharp_rings:
        mark_ring(rings[k])
    ob = finish(name, bm, mats, facing=facing, closed=closed, loc=loc, uv_fn=uv_fn)
    for p in ob.data.polygons:  # caps flat
        if len(p.vertices) > 4:
            p.use_smooth = False
    return ob


def flat_ngon(name, pts, h, mapper, mats, facing, loc=(0, 0, 0), uv_fn=None):
    bm = bmesh.new()
    vs = [bm.verts.new(mapper(p[0], p[1], h)) for p in pts]
    bm.faces.new(vs)
    return finish(name, bm, mats, facing=facing, smooth=False, loc=loc, uv_fn=uv_fn)


def arc_pts(c, r, a0, a1, steps):
    return [(c[0] + r * math.cos(math.radians(a0 + (a1 - a0) * k / steps)),
             c[1] + r * math.sin(math.radians(a0 + (a1 - a0) * k / steps))) for k in range(steps + 1)]


# ----------------------------------------------------------------------------- material helpers
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (900, 0)
    return m, nt, out


class NB:
    """tiny node-graph builder: numbers become default values, sockets get linked."""

    def __init__(self, nt):
        self.nt = nt
        self.k = 0

    def _put(self, sock, v):
        if isinstance(v, bpy.types.NodeSocket):
            self.nt.links.new(v, sock)
        elif v is not None:
            sock.default_value = v

    def new(self, typ, **inputs):
        n = self.nt.nodes.new(typ)
        self.k += 1
        n.location = (-1400 + (self.k % 12) * 110, -(self.k // 12) * 160)
        for key, v in inputs.items():
            self._put(n.inputs[key], v)
        return n

    def math(self, op, a, b=None, clamp=False):
        n = self.new('ShaderNodeMath')
        n.operation = op
        n.use_clamp = clamp
        self._put(n.inputs[0], a)
        if b is not None:
            self._put(n.inputs[1], b)
        return n.outputs[0]

    def add(self, a, b):
        return self.math('ADD', a, b)

    def sub(self, a, b):
        return self.math('SUBTRACT', a, b)

    def mul(self, a, b):
        return self.math('MULTIPLY', a, b)

    def abs(self, a):
        return self.math('ABSOLUTE', a)

    def lt(self, a, b):
        return self.math('LESS_THAN', a, b)

    def gt(self, a, b):
        return self.math('GREATER_THAN', a, b)

    def mx(self, a, b):
        return self.math('MAXIMUM', a, b)

    def mn(self, a, b):
        return self.math('MINIMUM', a, b)

    def band(self, x, c, hw):
        return self.lt(self.abs(self.sub(x, c)), hw)

    def len2(self, a, b):
        return self.math('SQRT', self.add(self.mul(a, a), self.mul(b, b)))

    def objmm(self):
        tc = self.new('ShaderNodeTexCoord')
        sc = self.new('ShaderNodeVectorMath')
        sc.operation = 'SCALE'
        self.nt.links.new(tc.outputs['Object'], sc.inputs[0])
        sc.inputs['Scale'].default_value = 1000.0
        sp = self.new('ShaderNodeSeparateXYZ')
        self.nt.links.new(sc.outputs[0], sp.inputs[0])
        return sp.outputs['X'], sp.outputs['Y'], sp.outputs['Z']

    def stadium_dist(self, a, b, L, r):
        """signed distance (mm) to a stadium of length L (along a) and radius r, centred at 0."""
        q = self.mx(self.sub(self.abs(a), L / 2 - r), 0.0)
        return self.sub(self.len2(q, b), r)


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)


def principled(nb, **kw):
    b = nb.new('ShaderNodeBsdfPrincipled')
    for k, v in kw.items():
        nb._put(b.inputs[k.replace('_', ' ')], v)
    return b


ALU_BASE = srgb('#33466E')      # metal reflectance (navy), darkened further by the anodic dye look
ALU_EDGE = srgb('#9FB2CF')      # F82 edge tint: silvery-blue grazing highlights


def alu_bsdf(nb, rough=0.30):
    """Deep Blue anodised aluminium: navy metal + thin clear anodic coat; faint roughness variation."""
    tc = nb.new('ShaderNodeTexCoord')
    nz = nb.new('ShaderNodeTexNoise', Scale=900.0, Detail=3.0)
    nb.nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    r = nb.add(rough - 0.025, nb.mul(nz.outputs['Fac'], 0.05))
    b = principled(nb, Base_Color=ALU_BASE, Metallic=1.0, Roughness=r, Specular_Tint=ALU_EDGE,
                   Coat_Weight=0.35, Coat_Roughness=0.16, Coat_IOR=1.6)
    return b


# ----------------------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = 'iPhone'
scene_coll = scene.collection
ROOT_EMPTY = bpy.data.objects.new('iPhone', None)
ROOT_EMPTY.empty_display_size = 0.08
ROOT_EMPTY.rotation_mode = 'QUATERNION'
scene_coll.objects.link(ROOT_EMPTY)

# ----------------------------------------------------------------------------- materials
# Frame aluminium with antenna bands, bottom port / speaker holes, earpiece slit, Camera Control gap.
m_frame, nt, out = new_mat('Alu_Frame')
nb = NB(nt)
alu = alu_bsdf(nb)
X, Y, Z = nb.objmm()
side_l = nb.lt(X, -(W / 2 - 3.0))
side_r = nb.gt(X, W / 2 - 3.0)
top = nb.gt(Z, H / 2 - 3.0)
bot = nb.lt(Z, -(H / 2 - 3.0))
on_rim = nb.lt(Y, HT - 0.02)  # not on the flat back face
bands = nb.mx(nb.mul(side_l, nb.mx(nb.band(Z, 57.5, 0.40), nb.band(Z, -57.5, 0.40))),
              nb.mul(side_r, nb.mx(nb.band(Z, 57.5, 0.40), nb.band(Z, -57.5, 0.40))))
bands = nb.mx(bands, nb.mul(top, nb.mx(nb.band(X, 20.0, 0.40), nb.band(X, -20.0, 0.40))))
bands = nb.mx(bands, nb.mul(bot, nb.mx(nb.band(X, 24.0, 0.40), nb.band(X, -24.0, 0.40))))
bands = nb.mul(bands, on_rim)
bface = nb.lt(Z, -(H / 2 - 0.35))   # bottom flat face
port = nb.lt(nb.stadium_dist(X, Y, 8.6, 1.3), 0.0)
ax = nb.abs(X)
cell = nb.sub(nb.math('FRACT', nb.math('DIVIDE', nb.sub(ax, 7.2), 1.55)), 0.5)
holes = nb.mul(nb.lt(nb.sub(nb.len2(nb.mul(cell, 1.55), Y), 0.48), 0.0),
               nb.mul(nb.gt(ax, 7.2), nb.lt(ax, 7.2 + 1.55 * 7)))
screws = nb.lt(nb.sub(nb.len2(nb.sub(ax, 5.75), Y), 0.55), 0.0)
holes = nb.mul(bface, nb.mx(nb.mx(port, holes), screws))
slit = nb.mul(nb.mul(nb.lt(nb.abs(X), 5.2), nb.band(Z, H / 2 - GLASS_D + 0.10, 0.14)), nb.lt(Y, -(HT - 0.45)))
cc_side, cc_z, cc_l, cc_h = CAMCTRL
ccd = nb.stadium_dist(nb.sub(Z, cc_z), Y, cc_l + 0.3, (cc_h + 0.3) / 2)
ccring = nb.mul(nb.gt(X, W / 2 - 0.6), nb.lt(nb.abs(ccd), 0.13))
holes = nb.mx(nb.mx(holes, slit), ccring)
resin = principled(nb, Base_Color=srgb('#141A26'), Roughness=0.32, Specular_IOR_Level=0.45)
hole = principled(nb, Base_Color=(0.002, 0.002, 0.0025, 1), Roughness=0.7)
mix1 = nb.new('ShaderNodeMixShader')
nt.links.new(bands, mix1.inputs['Fac'])
nt.links.new(alu.outputs[0], mix1.inputs[1])
nt.links.new(resin.outputs[0], mix1.inputs[2])
mix2 = nb.new('ShaderNodeMixShader')
nt.links.new(holes, mix2.inputs['Fac'])
nt.links.new(mix1.outputs[0], mix2.inputs[1])
nt.links.new(hole.outputs[0], mix2.inputs[2])
nt.links.new(mix2.outputs[0], out.inputs['Surface'])

m_alu, nt, out = new_mat('Alu')
nb = NB(nt)
nt.links.new(alu_bsdf(nb).outputs[0], out.inputs['Surface'])

# Black matrix / ink under the cover glass (border around the active area).
m_ink, nt, out = new_mat('Ink')
nb = NB(nt)
nt.links.new(principled(nb, Base_Color=(0.0025, 0.0026, 0.003, 1), Roughness=0.6,
                        Specular_IOR_Level=0.0).outputs[0], out.inputs['Surface'])

# Screen: emission from an sRGB image, strength 1, Standard view transform -> pixels round-trip.
m_screen, nt, out = new_mat('Screen')
nb = NB(nt)
img = nb.new('ShaderNodeTexImage')
img.name = 'ScreenImage'
img.image = bpy.data.images.load(os.path.join(ROOT, 'testpattern.png'))
img.image.colorspace_settings.name = 'sRGB'
img.interpolation = 'Linear'
img.extension = 'EXTEND'
uvn = nb.new('ShaderNodeUVMap')
nt.links.new(uvn.outputs['UV'], img.inputs['Vector'])
em = nb.new('ShaderNodeEmission', Strength=1.0)
em.name = 'ScreenEmission'
nt.links.new(img.outputs['Color'], em.inputs['Color'])
nt.links.new(em.outputs[0], out.inputs['Surface'])
m_screen.cycles.emission_sampling = 'NONE'

# Dynamic Island: deep black display hole, faint front-camera lens on the right.
m_island, nt, out = new_mat('Island')
nb = NB(nt)
X, Y, Z = nb.objmm()
isl_cz = H / 2 - DISP_D - ISL_TOP - ISL_H / 2
lr = nb.len2(nb.sub(X, ISL_W / 2 - ISL_H / 2 - 0.15), nb.sub(Z, isl_cz))
lens_ring = nb.mul(nb.lt(lr, 1.25), nb.gt(lr, 0.95))
lens_in = nb.lt(lr, 0.75)
col = nb.new('ShaderNodeMix')
col.data_type = 'RGBA'
nt.links.new(nb.mx(nb.mul(lens_ring, 0.6), nb.mul(lens_in, 1.0)), col.inputs['Factor'])
col.inputs['A'].default_value = (0.0015, 0.0015, 0.0018, 1)
col.inputs['B'].default_value = (0.010, 0.012, 0.020, 1)
b = principled(nb, Roughness=0.6, Specular_IOR_Level=0.0)
nt.links.new(col.outputs['Result'], b.inputs['Base Color'])
nt.links.new(b.outputs[0], out.inputs['Surface'])


def skin_material(name, ior, rough, tint=(1, 1, 1, 1), additive=False):
    """Thin coating: Fresnel-weighted mirror over a transparent pass-through (no refraction).
    additive=True: 100 % transmission + reflection on top (content keeps its exact colours; the 3D cut frame
    then equals the 2D stack content + front_glass)."""
    m, nt, out = new_mat(name)
    nb = NB(nt)
    fr = nb.new('ShaderNodeFresnel', IOR=ior)
    tr = nb.new('ShaderNodeBsdfTransparent', Color=tint)
    gl = nb.new('ShaderNodeBsdfGlossy', Roughness=rough)
    gl.distribution = 'GGX'
    if additive:
        cm = nb.new('ShaderNodeCombineColor')
        for k in range(3):
            nt.links.new(fr.outputs[0], cm.inputs[k])
        nt.links.new(cm.outputs[0], gl.inputs['Color'])
        mix = nb.new('ShaderNodeAddShader')
        nt.links.new(tr.outputs[0], mix.inputs[0])
        nt.links.new(gl.outputs[0], mix.inputs[1])
    else:
        mix = nb.new('ShaderNodeMixShader')
        nt.links.new(fr.outputs[0], mix.inputs['Fac'])
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(gl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


m_glass = skin_material('CoverGlass', 1.52, 0.012, additive=True)
m_sapph = skin_material('Sapphire', 1.77, 0.01, tint=(0.97, 0.98, 1.0, 1))

# Back: frosted (matte) colour-matched glass panel.
m_backglass, nt, out = new_mat('BackGlass')
nb = NB(nt)
nt.links.new(principled(nb, Base_Color=srgb('#2A3A5E'), Metallic=0.45, Roughness=0.34, IOR=1.5,
                        Specular_IOR_Level=0.55, Coat_Weight=0.25, Coat_Roughness=0.32).outputs[0],
             out.inputs['Surface'])

# Camera internals
m_lensblack, nt, out = new_mat('LensBlack')
nb = NB(nt)
X, Y, Z = nb.objmm()
rr = nb.len2(X, Z)
grooves = nb.math('SINE', nb.mul(rr, 2 * math.pi / 0.16))
bump = nb.new('ShaderNodeBump', Strength=0.5, Distance=0.00002)
nt.links.new(grooves, bump.inputs['Height'])
b = principled(nb, Base_Color=(0.012, 0.012, 0.014, 1), Roughness=0.30, Specular_IOR_Level=0.5)
nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
nt.links.new(b.outputs[0], out.inputs['Surface'])

m_lensring, nt, out = new_mat('LensRing')
nb = NB(nt)
nt.links.new(principled(nb, Base_Color=(0.30, 0.30, 0.32, 1), Metallic=1.0, Roughness=0.18).outputs[0],
             out.inputs['Surface'])

m_element, nt, out = new_mat('LensElement')
nb = NB(nt)
nt.links.new(principled(nb, Base_Color=(0.0, 0.0, 0.0, 1), Roughness=0.04, IOR=1.75, Specular_IOR_Level=0.22,
                        Thin_Film_Thickness=300.0, Thin_Film_IOR=1.38).outputs[0], out.inputs['Surface'])

m_flash, nt, out = new_mat('Flash')
nb = NB(nt)
X, Y, Z = nb.objmm()
rr = nb.len2(X, Z)
ridges = nb.math('SINE', nb.mul(rr, 2 * math.pi / 0.35))
bump = nb.new('ShaderNodeBump', Strength=0.35, Distance=0.00003)
nt.links.new(ridges, bump.inputs['Height'])
edge = nb.gt(rr, 2.75)
col = nb.new('ShaderNodeMix')
col.data_type = 'RGBA'
nt.links.new(edge, col.inputs['Factor'])
col.inputs['A'].default_value = srgb('#D9D2BE')
col.inputs['B'].default_value = (0.004, 0.004, 0.005, 1)
b = principled(nb, Roughness=0.25, Specular_IOR_Level=0.6, Coat_Weight=0.6, Coat_Roughness=0.03)
nt.links.new(col.outputs['Result'], b.inputs['Base Color'])
nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
nt.links.new(b.outputs[0], out.inputs['Surface'])

m_lidar, nt, out = new_mat('Lidar')
nb = NB(nt)
X, Y, Z = nb.objmm()
rr = nb.len2(X, Z)
col = nb.new('ShaderNodeMix')
col.data_type = 'RGBA'
nt.links.new(nb.mul(nb.lt(rr, 1.9), nb.gt(rr, 1.5)), col.inputs['Factor'])
col.inputs['A'].default_value = (0.003, 0.003, 0.004, 1)
col.inputs['B'].default_value = (0.02, 0.018, 0.03, 1)
b = principled(nb, Roughness=0.06, Specular_IOR_Level=0.8, Coat_Weight=1.0, Coat_Roughness=0.02)
nt.links.new(col.outputs['Result'], b.inputs['Base Color'])
nt.links.new(b.outputs[0], out.inputs['Surface'])

m_holeblack, nt, out = new_mat('HoleBlack')
nb = NB(nt)
nt.links.new(principled(nb, Base_Color=(0.001, 0.001, 0.001, 1), Roughness=0.9).outputs[0], out.inputs['Surface'])

m_camctrl, nt, out = new_mat('CamControl')
nb = NB(nt)
nt.links.new(principled(nb, Base_Color=srgb('#141A24'), Roughness=0.05, IOR=1.77, Specular_IOR_Level=0.8,
                        Coat_Weight=1.0, Coat_Roughness=0.01, Coat_IOR=1.77).outputs[0], out.inputs['Surface'])

# ----------------------------------------------------------------------------- geometry
OUT = squircle_rect(W, H, CORNER_E, CORNER_N, SEG_CORNER)
front = lambda x, y, h: P(x, y, h)  # noqa: E731
F_FRONT = dirP(0, 0, 1)
F_BACK = dirP(0, 0, -1)

# Frame: lip under the glass edge -> front rim -> flat side -> back rim -> back face (cap).
prof = [(GLASS_D, 4.10), (GLASS_D, W_LIP), (RF, W_LIP)]
for k in range(1, 15):
    a = math.radians(90 * k / 14)
    prof.append((RF * (1 - math.sin(a)), (W_LIP - RF) + RF * math.cos(a)))
for k in range(0, 17):
    a = math.radians(90 * k / 16)
    prof.append((RB * (1 - math.cos(a)), (W_BACK + RB) - RB * math.sin(a)))
prof.append((RB + 0.6, W_BACK))
frame = loft('Frame', OUT, prof, front, [m_frame], cap_first=True, cap_last=True, closed=True, sharp_rings=(1,))

# Black border ink (under the frame lip and the glass) + screen + island + cover glass skins.
ink = flat_ngon('Ink', offset(OUT, GLASS_D - 0.2), W_INK, front, [m_ink], F_FRONT)
DISP = offset(OUT, DISP_D)
dx0, dx1 = min(p[0] for p in DISP), max(p[0] for p in DISP)
dy0, dy1 = min(p[1] for p in DISP), max(p[1] for p in DISP)


def screen_uv(co):
    u, v = co.x / MM, co.z / MM
    return ((u - dx0) / (dx1 - dx0), (v - dy0) / (dy1 - dy0))


screen = flat_ngon('Screen', DISP, W_SCREEN, front, [m_screen], F_FRONT, uv_fn=screen_uv)
screen['disp_bbox_mm'] = [dx0, dy0, dx1, dy1]
isl_v = dy1 - ISL_TOP - ISL_H / 2
island = flat_ngon('Island', stadium(ISL_W, ISL_H, 48, 0.0, isl_v), W_ISLAND, front, [m_island], F_FRONT)
gprof = []
for k in range(0, 13):
    a = math.radians(90 * k / 12)
    gprof.append((GLASS_D + 0.45 * (1 - math.cos(a)), (W_GLASS - 0.12) + 0.12 * math.sin(a)))
gprof.append((DISP_D, W_GLASS))
# the glass curve rings must lie on the same outline normals as the display edge: loft from OUT
glass_border = loft('GlassBorder', OUT, gprof, front, [m_glass], facing=F_FRONT)
glass_screen = flat_ngon('GlassScreen', DISP, W_GLASS, front, [m_glass], F_FRONT)

# Back: matte glass panel below the plateau.
BP = clip_fillet(offset(OUT, 3.0), PLAT_BOTTOM - 2.2, False, 5.0)
back_panel = loft('BackPanel', BP, [(0.0, W_BACK + 0.05), (0.0, W_BACK - 0.005), (0.04, W_BACK - 0.022),
                                    (0.10, W_BACK - 0.03)], front, [m_backglass], cap_first=True, cap_last=True,
                  closed=True)

# Camera plateau: full width, sides flush with the rails, rounded top edge.
PL = clip_fillet(offset(OUT, 0.05), PLAT_BOTTOM, True, 4.5)
RP = 0.9
pprof = [(0.0, -3.30), (0.0, W_PLAT + RP)]
for k in range(1, 15):
    a = math.radians(90 * k / 14)
    pprof.append((RP * (1 - math.cos(a)), (W_PLAT + RP) - RP * math.sin(a)))
plateau = loft('Plateau', PL, pprof, front, [m_alu], cap_first=True, cap_last=True, closed=True)


# Lenses: device-coloured housing ring, black barrel, ring, AR-coated element, sapphire cover.
def lens_mapper(x, y, h):
    return P(x, y, -h)


for name, lu, lv, rel in LENSES:
    loc = P(lu, lv, W_PLAT)
    seg = 160
    C = circle(10.0, seg)
    R0 = 10.0
    hp = [(8.0, -0.3), (8.0, 1.30)]
    for k in range(1, 11):
        a = math.radians(90 * k / 10)
        hp.append((7.5 + 0.5 * math.cos(a), 1.30 + 0.5 * math.sin(a)))
    hp += [(6.75, 1.80), (6.35, 1.60), (6.35, 0.60)]
    housing = loft('Lens%s_Housing' % name, C, [(R0 - r, h) for r, h in hp], lens_mapper, [m_alu, m_lensblack],
                   close_profile=True, closed=True, loc=loc,
                   seg_mats=[0] * (len(hp) - 2) + [1, 1], sharp_rings=(0, len(hp) - 3, len(hp) - 2, len(hp) - 1))
    barrel = loft('Lens%s_Barrel' % name, C, [(R0 - 6.36, 0.60), (R0 - 5.75, 0.66), (R0 - 5.62, 0.74),
                                              (R0 - (rel + 0.18), 0.95)], lens_mapper,
                  [m_lensblack, m_lensring], seg_mats=[1, 1, 0], facing=dirP(0, 0, -1), loc=loc,
                  sharp_rings=(1, 2))
    ring = loft('Lens%s_Ring' % name, C, [(R0 - (rel + 0.18), 0.95), (R0 - rel, 1.0), (R0 - rel, 0.92)],
                lens_mapper, [m_lensring], facing=dirP(0, 0, -1), loc=loc, sharp_rings=(1,))
    ep = []
    for k in range(0, 9):
        r = rel * (1 - k / 9)
        ep.append((R0 - r, 0.92 + 0.22 * (1 - (r / rel) ** 2)))
    element = loft('Lens%s_Element' % name, C, ep, lens_mapper, [m_element], cap_last=True,
                   facing=dirP(0, 0, -1), loc=loc)
    cover = flat_ngon('Lens%s_Cover' % name, circle(6.36, seg), 1.62, lens_mapper, [m_sapph], dirP(0, 0, -1), loc=loc)

for name, (cu, cv), rad, mat in (('Flash', FLASH, 3.2, m_flash), ('Lidar', LIDAR, 3.1, m_lidar),
                                 ('Mic', MIC, 0.5, m_holeblack)):
    flat_ngon(name, circle(rad, 96), 0.01, lens_mapper, [mat], dirP(0, 0, -1), loc=P(cu, cv, W_PLAT))


# Side buttons: stadium pills protruding 0.6 mm with rounded crown edge.
def side_mapper(side):
    return lambda x, y, h: P(side * (W / 2 + h), x, y)


bprof = [(0.0, -0.4), (0.0, 0.36)]
for k in range(1, 9):
    a = math.radians(90 * k / 8)
    bprof.append((0.24 * (1 - math.cos(a)), 0.36 + 0.24 * math.sin(a)))
for name, side, cv, L, Hb in BUTTONS:
    loft(name, stadium(L, Hb, 40, cv, 0.0), bprof, side_mapper(side), [m_alu], cap_first=True, cap_last=True,
         closed=True)
cc_side, cc_v, cc_l, cc_h = CAMCTRL
loft('CameraControl', stadium(cc_l, cc_h, 40, cc_v, 0.0), [(0.0, -0.3), (0.0, 0.0), (0.06, 0.018), (0.14, 0.024)],
     side_mapper(cc_side), [m_camctrl], cap_first=True, cap_last=True, closed=True)

# ----------------------------------------------------------------------------- world + lights
world = bpy.data.worlds.new('Studio')
world.use_nodes = True
wn = world.node_tree
for n in list(wn.nodes):
    wn.nodes.remove(n)
wo = wn.nodes.new('ShaderNodeOutputWorld')
bg = wn.nodes.new('ShaderNodeBackground')
tc = wn.nodes.new('ShaderNodeTexCoord')
sp = wn.nodes.new('ShaderNodeSeparateXYZ')
ramp = wn.nodes.new('ShaderNodeValToRGB')
wn.links.new(tc.outputs['Generated'], sp.inputs[0])
wn.links.new(sp.outputs['Z'], ramp.inputs['Fac'])
ramp.color_ramp.elements[0].position = 0.15
ramp.color_ramp.elements[0].color = (0.006, 0.0065, 0.008, 1)
ramp.color_ramp.elements[1].position = 1.0
ramp.color_ramp.elements[1].color = (0.11, 0.115, 0.125, 1)
wn.links.new(ramp.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 1.0
wn.links.new(bg.outputs[0], wo.inputs['Surface'])
scene.world = world


def area(name, loc, size, size_y, energy, color=(1, 1, 1), target=(0, 0, 0), spread=180):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size = size
    ld.size_y = size_y
    ld.energy = energy
    ld.color = color
    ld.spread = math.radians(spread)
    ob = bpy.data.objects.new(name, ld)
    scene_coll.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    ob.visible_camera = False
    return ob


area('Key', (-0.75, -0.50, 0.55), 0.90, 0.60, 6.0, color=(1.0, 0.985, 0.97))
area('Fill', (0.70, -0.60, -0.25), 0.80, 0.80, 2.0, color=(0.92, 0.95, 1.0))
area('Back', (0.25, 0.75, 0.30), 0.90, 0.60, 5.0)
# thin kickers right behind the phone: crisp silhouette lines on the rounded rims
area('EdgeL', (-0.22, 0.60, 0.02), 0.025, 1.20, 3.0, color=(0.95, 0.97, 1.0))
area('EdgeR', (0.24, 0.62, 0.0), 0.025, 1.20, 3.0)


def softbox(name, loc, w, h, peak, target=(0, 0, 0), color=(1, 1, 1), bias=0.55, edge=0.30):
    """Emissive strip with a soft-edged, top-weighted gradient (long gradient highlights on flat metal)."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new(v) for v in ((-w / 2, -h / 2, 0), (-w / 2, h / 2, 0), (w / 2, h / 2, 0), (w / 2, -h / 2, 0))]
    f = bm.faces.new(vs)  # normal -Z (faces the target after tracking)
    for lp, uv in zip(f.loops, ((0, 0), (0, 1), (1, 1), (1, 0))):
        lp[uvl].uv = uv
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene_coll.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    m, nt, out = new_mat('M_' + name)
    nb = NB(nt)
    uvn = nb.new('ShaderNodeUVMap')
    sp = nb.new('ShaderNodeSeparateXYZ')
    nt.links.new(uvn.outputs['UV'], sp.inputs[0])
    u, v = sp.outputs['X'], sp.outputs['Y']

    def soft(x):
        mr = nb.new('ShaderNodeMapRange', **{'From Min': 0.0, 'From Max': edge, 'To Min': 0.0, 'To Max': 1.0})
        mr.interpolation_type = 'SMOOTHSTEP'
        nt.links.new(nb.mn(x, nb.sub(1.0, x)), mr.inputs['Value'])
        return mr.outputs[0]
    prof = nb.mul(soft(u), soft(v))
    prof = nb.mul(prof, nb.add(1.0 - bias, nb.mul(v, bias)))
    em = nb.new('ShaderNodeEmission', Color=tuple(color) + (1,))
    nt.links.new(nb.mul(prof, peak), em.inputs['Strength'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    m.cycles.emission_sampling = 'FRONT'
    me.materials.append(m)
    ob.visible_camera = False
    ob.visible_shadow = False
    return ob


softbox('SoftL', (-0.40, 0.28, 0.05), 0.26, 1.00, 4.0, color=(0.95, 0.97, 1.0))
softbox('SoftR', (0.42, 0.30, 0.0), 0.22, 1.00, 3.0)
softbox('SoftFR', (0.75, -0.50, 0.25), 0.45, 0.60, 0.9, bias=0.6)
softbox('SoftTop', (0.0, 0.05, 0.60), 1.20, 0.45, 5.0, target=(0, 0, 0.02), bias=0.0)
# side strips at ~90 deg: they draw the bright line on the front rim radius in the front pose
softbox('SideL', (-0.55, -0.05, 0.05), 0.30, 1.10, 4.0, color=(0.95, 0.97, 1.0))
softbox('SideR', (0.55, -0.03, 0.0), 0.30, 1.10, 2.0)

# Flags: the broad front fills must not veil the cover glass / camera covers (they only shape the metal).
flag = bpy.data.collections.new('LL_NoFill')
for n in ('GlassScreen', 'GlassBorder', 'Lidar') + tuple('Lens%s_Cover' % l[0] for l in LENSES):
    flag.objects.link(bpy.data.objects[n])
for n in ('Fill', 'SoftFR'):
    bpy.data.objects[n].light_linking.receiver_collection = flag
for cobj in flag.collection_objects:
    cobj.light_linking.link_state = 'EXCLUDE'
# camera covers + LiDAR are flagged from every broad source (keeps the lenses deep and dark, not milky)
flag2 = bpy.data.collections.new('LL_Covers')
for n in ('Lidar',) + tuple('Lens%s_Cover' % l[0] for l in LENSES):
    flag2.objects.link(bpy.data.objects[n])
for n in ('Key', 'Back', 'SoftL', 'SoftR', 'SoftTop', 'SideL', 'SideR'):
    bpy.data.objects[n].light_linking.receiver_collection = flag2
for cobj in flag2.collection_objects:
    cobj.light_linking.link_state = 'EXCLUDE'

# Glass sheen card: emissive gradient seen only in reflections (front glass sheen, max ~12 %).
CARD_Y = -0.35
card_scale = (0.759 + abs(CARD_Y)) / 0.759  # reflection magnification at the card plane
bm = bmesh.new()
cw, ch = 0.125 * card_scale, 0.23 * card_scale
vs = [bm.verts.new((x, CARD_Y, z)) for x, z in ((-cw, -ch), (cw, -ch), (cw, ch), (-cw, ch))]
bm.faces.new(vs)
me = bpy.data.meshes.new('SheenCard')
bm.to_mesh(me)
bm.free()
card = bpy.data.objects.new('SheenCard', me)
scene_coll.objects.link(card)
if card.data.polygons[0].normal.y < 0:
    card.data.flip_normals()
m_card, nt, out = new_mat('SheenCard')
nb = NB(nt)
X, Y, Z = nb.objmm()
xs = nb.math('DIVIDE', nb.math('DIVIDE', X, card_scale), 33.3)   # screen-normalised coords seen in the mirror
ys = nb.math('DIVIDE', nb.math('DIVIDE', Z, card_scale), 72.4)
t = nb.sub(nb.mul(ys, 0.92), nb.mul(xs, 0.38))
sheen = nb.new('ShaderNodeMapRange', **{'From Min': 0.30, 'From Max': 1.10, 'To Min': 0.0, 'To Max': 1.0})
sheen.interpolation_type = 'SMOOTHERSTEP'
nt.links.new(t, sheen.inputs['Value'])
streak = nb.new('ShaderNodeMapRange', **{'From Min': 0.0, 'From Max': 0.16, 'To Min': 1.0, 'To Max': 0.0})
streak.interpolation_type = 'SMOOTHSTEP'
nt.links.new(nb.abs(nb.sub(t, 0.18)), streak.inputs['Value'])
val = nb.add(nb.mul(sheen.outputs[0], 1.0), nb.mul(streak.outputs[0], 0.10))
emc = nb.new('ShaderNodeEmission', Color=(0.93, 0.96, 1.0, 1))
emc.name = 'SheenEmission'
nt.links.new(nb.mul(val, 0.22), emc.inputs['Strength'])
nt.links.new(emc.outputs[0], out.inputs['Surface'])
m_card.cycles.emission_sampling = 'NONE'
card.data.materials.append(m_card)
for attr in ('visible_camera', 'visible_diffuse', 'visible_shadow', 'visible_transmission', 'visible_volume_scatter'):
    setattr(card, attr, False)

# ----------------------------------------------------------------------------- camera (front pose)
LENS, SENSOR = 85.0, 36.0
RES_X, RES_Y = 1920, 1080
sensor_h = SENSOR * RES_Y / RES_X
z_front_side = W_LIP - RF            # the silhouette is the flat side's front edge (nearest)
target_px = 900.0                    # phone height in a 1080p frame (1800 at 2x)
dist = (H * LENS * RES_Y) / (target_px * sensor_h) + z_front_side
cam_d = bpy.data.cameras.new('Camera')
cam_d.lens = LENS
cam_d.sensor_width = SENSOR
cam_d.sensor_fit = 'HORIZONTAL'
cam_d.clip_start = 0.05
cam_d.clip_end = 20
cam = bpy.data.objects.new('Camera', cam_d)
scene_coll.objects.link(cam)
scene.camera = cam
cam.location = (0.0, -dist * MM, 0.0)
cam.rotation_euler = (math.pi / 2, 0.0, 0.0)
print('camera distance %.3f mm' % dist)

# ----------------------------------------------------------------------------- render settings
r = scene.render
r.engine = 'CYCLES'
r.resolution_x, r.resolution_y, r.resolution_percentage = RES_X, RES_Y, 100
r.fps = 30
r.film_transparent = True
r.use_persistent_data = True
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA'
r.image_settings.color_depth = '8'
r.use_motion_blur = False
r.motion_blur_shutter = 0.5
r.threads_mode = 'FIXED'
r.threads = 4
c = scene.cycles
c.device = 'CPU'
c.samples = 12
c.use_adaptive_sampling = True
c.adaptive_threshold = 0.02
c.adaptive_min_samples = 8
c.use_denoising = True
c.denoiser = 'OPENIMAGEDENOISE'
c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
c.denoising_prefilter = 'ACCURATE'
c.denoising_quality = 'BALANCED'
c.max_bounces = 8
c.diffuse_bounces = 2
c.glossy_bounces = 4
c.transmission_bounces = 2
c.transparent_max_bounces = 12
c.volume_bounces = 0
c.caustics_reflective = False
c.caustics_refractive = False
c.sample_clamp_direct = 0.0
c.sample_clamp_indirect = 4.0
c.blur_glossy = 0.5
c.filter_width = 1.0  # crisper screen text: matches a browser-scaled PNG at the 3D->2D cut
c.seed = 11
c.use_animated_seed = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0.0
scene.view_settings.gamma = 1.0
scene.display_settings.display_device = 'sRGB'
scene.frame_start, scene.frame_end = 0, 89

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'iphone.blend'), compress=True)
print('saved iphone.blend  objects=%d' % len(bpy.data.objects))
