"""Render one shot of the PurePeptide vial film (deterministic, CPU Cycles).

usage: .venv/bin/python tools/render_shot.py <shot> <frames> [--pct N] [--samples N] [--out DIR]
  shot   : macro_sweep | turntable | cap_top | hero | hero_still
  frames : "all" | "12" | "1-90" | "1,45,90"  (1-based frame numbers)
Output : renders/<shot>/####.png  (hero_still -> renders/hero_still.png at 3840x2160)
"""
import argparse
import math
import os
import sys
import time

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))

SHOTS = {  # name: (seconds, default lens)
    'macro_sweep': 3.0,
    'turntable': 4.0,
    'cap_top': 2.5,
    'hero': 3.0,
    'hero_still': 3.0,
}
FPS = 30


def ease(t):  # smooth in/out
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ease_io(t):  # softer (sine)
    t = max(0.0, min(1.0, t))
    return 0.5 - 0.5 * math.cos(math.pi * t)


def lerp(a, b, t):
    return a + (b - a) * t


def vlerp(a, b, t):
    return Vector(a).lerp(Vector(b), t)


def aim(cam, loc, target, roll=0.0):
    cam.location = loc
    q = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y')
    cam.rotation_euler = q.to_euler()
    if roll:
        cam.rotation_euler.rotate_axis('Z', roll)
    cam.data.dof.focus_distance = (Vector(target) - Vector(loc)).length


class Rig:
    def __init__(self, scene):
        self.s = scene
        self.cam = scene.camera
        self.vial = bpy.data.objects['Vial']
        self.L = {n: bpy.data.objects[n] for n in ('Key_Rim', 'Strip_L', 'Strip_R', 'Top', 'Fill', 'Card')}
        self.base = {n: (o.location.copy(), o.data.energy) for n, o in self.L.items()}
        self.pivot = bpy.data.objects.new('LightPivot', None)
        scene.collection.objects.link(self.pivot)
        for o in self.L.values():
            o.parent = self.pivot
        self.target = Vector((0, 0, 0.025))

    def strips_orbit(self, deg):
        """rotate the two strip lights around the vial axis (moves their reflections)."""
        for n in ('Strip_L', 'Strip_R'):
            o = self.L[n]
            p0, _ = self.base[n]
            a = math.radians(deg)
            p = Vector((p0.x * math.cos(a) - p0.y * math.sin(a), p0.x * math.sin(a) + p0.y * math.cos(a), p0.z))
            o.location = p
            o.rotation_euler = (Vector((0, 0, p0.z * 0.2)) - p).to_track_quat('-Z', 'Y').to_euler()

    def energy(self, name, mult):
        self.L[name].data.energy = self.base[name][1] * mult


def setup_frame(rig, shot, t):
    cam = rig.cam
    cd = cam.data
    rig.vial.rotation_euler = (0, 0, 0)
    rig.strips_orbit(0)
    for n in rig.L:
        rig.energy(n, 1.0)
    if shot == 'macro_sweep':
        # 100 mm macro, f/2.8, glides along the shoulder / label top edge; strip reflection sweeps.
        cd.lens = 100
        cd.dof.aperture_fstop = 5.6
        e = ease_io(t)
        x = lerp(-0.022, 0.020, e)
        loc = Vector((x, -0.150, lerp(0.050, 0.043, e)))
        tgt = Vector((x * 0.35, -0.004, lerp(0.0345, 0.0325, e)))
        aim(cam, loc, tgt, roll=math.radians(lerp(-3, 2, e)))
        # focus plane on the front edge of the label top (glass surface facing camera)
        fp = Vector((x * 0.3, -0.0121, 0.0300))
        cd.dof.focus_distance = (fp - loc).dot((tgt - loc).normalized())
        rig.strips_orbit(lerp(-38, 30, ease_io(t)))
        rig.vial.rotation_euler = (0, 0, math.radians(lerp(8, -4, e)))
    elif shot == 'turntable':
        # hero 3/4 low angle, vial rotates 120 deg, strips counter-orbit so reflections slide.
        cd.lens = 70
        cd.dof.aperture_fstop = 8.0
        az = math.radians(-28)
        dist = 0.30
        loc = (dist * math.sin(az), -dist * math.cos(az), 0.016)
        aim(cam, loc, (0, 0, 0.0275))
        rig.vial.rotation_euler = (0, 0, math.radians(lerp(-60, 60, t)))
        rig.strips_orbit(lerp(18, -18, t))
    elif shot == 'cap_top':
        # descend to a top 3/4 view of the flip-off cap + crimp.
        cd.lens = 100
        cd.dof.aperture_fstop = 4.0
        e = ease_io(t)
        el = math.radians(lerp(12, 48, e))
        az = math.radians(lerp(-18, -30, e))
        dist = lerp(0.145, 0.125, e)
        tgt = Vector((0, 0, lerp(0.0505, 0.0525, e)))
        loc = tgt + Vector((dist * math.cos(el) * math.sin(az), -dist * math.cos(el) * math.cos(az), dist * math.sin(el)))
        aim(cam, loc, tgt)
        cd.dof.focus_distance = (tgt - loc).length - 0.004
        rig.vial.rotation_euler = (0, 0, math.radians(-20))
        rig.strips_orbit(lerp(-10, 10, e))
        rig.energy('Top', 0.5)
        rig.energy('Fill', 0.4)
    elif shot in ('hero', 'hero_still'):
        # centred hero, slow push-in, rim light rises. Final frame = clean title frame.
        cd.lens = 85
        cd.dof.aperture_fstop = 8.0
        e = ease(t) if shot == 'hero' else 1.0
        tt = t if shot == 'hero' else 1.0
        dist = lerp(0.40, 0.355, 1 - (1 - tt) ** 2)
        loc = (0, -dist, 0.03)
        aim(cam, loc, (0, 0, 0.0285))
        rig.energy('Key_Rim', lerp(0.15, 1.0, e))
        rig.energy('Top', lerp(0.5, 1.0, e))
    else:
        raise SystemExit('unknown shot ' + shot)


def parse_frames(spec, n):
    if spec == 'all':
        return list(range(1, n + 1))
    out = []
    for part in spec.split(','):
        if '-' in part:
            a, b = part.split('-')
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return [f for f in out if 1 <= f <= n]


def main():
    argv = sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('shot')
    ap.add_argument('frames', nargs='?', default='all')
    ap.add_argument('--pct', type=int, default=100)
    ap.add_argument('--samples', type=int, default=0)
    ap.add_argument('--out', default='')
    ap.add_argument('--haze', action='store_true')
    ap.add_argument('--exec', default='', help='debug: python run after setup of each frame')
    a = ap.parse_args(argv)

    bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, 'scene.blend'))
    scene = bpy.context.scene
    scene.render.resolution_percentage = a.pct
    if a.samples:
        scene.cycles.samples = a.samples
    if a.haze:
        bpy.data.objects['Haze'].hide_render = False
    rig = Rig(scene)
    n = int(round(SHOTS[a.shot] * FPS))
    if a.shot == 'hero_still':
        scene.render.resolution_x, scene.render.resolution_y = 3840, 2160
        frames = [n]
    else:
        frames = parse_frames(a.frames, n)
    outdir = a.out or os.path.join(ROOT, 'renders', a.shot)
    os.makedirs(outdir, exist_ok=True)
    times = []
    for f in frames:
        t = (f - 1) / max(1, n - 1)
        setup_frame(rig, a.shot, t)
        scene.frame_set(f)
        if a.exec:
            exec(a.exec, {'bpy': bpy, 'scene': scene, 'rig': rig})
        path = os.path.join(outdir, '%04d.png' % f) if a.shot != 'hero_still' else os.path.join(ROOT, 'renders', 'hero_still.png')
        scene.render.filepath = path
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        dt = time.time() - t0
        times.append(dt)
        print('FRAME %s %d %.1fs -> %s' % (a.shot, f, dt, path), flush=True)
    if times:
        print('DONE %s frames=%d avg=%.1fs total=%.0fs' % (a.shot, len(times), sum(times) / len(times), sum(times)), flush=True)


if __name__ == '__main__':
    main()
