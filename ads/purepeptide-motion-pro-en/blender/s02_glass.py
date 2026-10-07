"""S02 "Printed on glass" f126–f216: the phone's black cover glass, the word "pure" present only as a reflection of the
PureReflect plane (SHOTS S02). Camera + lights fixed; the phone turns (drift / eased move / drift); the plane is
re-placed every frame so the ghost follows the authored track on the display (a flat mirror sweeps its reflections at
2× the spin: 2.4° of spin crosses the whole glass, so the plane orbits to keep the ghost readable: see reflect_place).

usage: PY blender/s02_glass.py [--range 126-216] [--pct 100] [--samples 24] [--E 6] [--dist 0.30] [--width 0.08]
                               [--flip] [--preview] [--force]
outputs: renders/3d/s02/{beauty,matte_phone,matte_cards,matte_screen}/####.png, corners.json, pose_speed.json, log.json
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as C  # noqa: E402
import bpy  # noqa: E402

F0, F1 = 126, 216
# ghost track on the display (mm from the display centre; +x right, +z up): left of centre at KF2 (f150), crosses
# the centre near "hard" (f161), fully off the right edge by "prove." (f180); the display half-width is 33.3 mm and
# the ghost word is ~37 mm wide (plane 0.044 m at 0.15 m: ×0.85; closer = less DOF blur, readable) → x ≥ 33.3 + 18.5 + 4 = 56 mm is out.
GHOST_Z = 8.0


def ghost_x(f):
    if f <= 150:
        return -10.0 + 6.0 * (f - F0) / (150 - F0)
    if f <= 186:
        return -4.0 + 62.0 * C.bez((f - 150) / 36.0)
    return 58.0 + 8.0 * (f - 186) / 30.0


def build(scene, root, E=3.6, dist=0.15, width=0.044, flip=False, tint=(0.93, 0.96, 1.0), link=True):
    C.screen(os.path.join(C.TYPE, 'screen_off.png'))
    C.set_cold(F0)
    C.dof(scene, root)
    C.dof_key(F0, True, 4.0, 0.0)              # f/4, focus on the glass centre
    # phone: spin −22 → +6, tilt −8 → −3, roll −3 → +1.5, loc x −0.02 → +0.01 (drift / move / drift)
    PA = (-22.0, -8.0, -3.0, (-0.020, 0.084, 0.0))
    PB = (-19.0, -7.5, -2.7, (-0.018, 0.084, 0.0))
    PC = (5.0, -3.3, 1.3, (0.009, 0.084, 0.0))
    PD = (6.0, -3.0, 1.5, (0.010, 0.084, 0.0))
    C.move(root, F0, 150, PA, PB, ease=C.sine_inout)
    C.move(root, 150, 186, PB, PC, ease=C.bez)
    C.move(root, 186, F1, PC, PD, ease=C.sine_inout)
    # the reflected word
    png = os.path.join(C.TYPE, 'pure_4k.png' if flip else 'pure_4k_mirror.png')
    plane = C.reflect_plane(png, E=E, width=width, tint=tint, link_to=('GlassScreen',) if link else ())
    for f in range(F0, F1 + 1):
        C.reflect_place(plane, scene, root, f, (ghost_x(f), GHOST_Z), dist=dist)
    # SoftTop band: x 0 until f186, slides to −0.30 by f192, crosses to +0.30 by f216 (peaks on the cut frame)
    C.softtop_x_key(F0, 0.0)
    C.softtop_x_key(186, 0.0)
    C.softtop_x_key(192, -0.30)
    C.softtop_x_key(F1, 0.30)
    scene.frame_set(F0)
    return plane


def main():
    ap = C.cli('S02 black glass', default_range='%d-%d' % (F0, F1))
    ap.add_argument('--E', type=float, default=3.6)
    ap.add_argument('--dist', type=float, default=0.15)
    ap.add_argument('--width', type=float, default=0.044)
    ap.add_argument('--flip', action='store_true', help='use the unmirrored PNG (if the ghost reads backwards)')
    ap.add_argument('--no-link', action='store_true', help='no light linking (the rails see the plane too)')
    args = C.apply_preview(ap.parse_args())
    C.lock()
    scene, root = C.load(F0, F1, denoise=not args.no_denoise)
    build(scene, root, E=args.E, dist=args.dist, width=args.width, flip=args.flip, link=not args.no_link)
    outdir = C.outdir_for('s02', args)
    C.passes(scene, outdir, mattes=True)
    if args.exec:
        exec(args.exec, {'bpy': bpy, 'scene': scene, 'root': root, 'C': C})
    frames = C.parse_range(args.range)
    C.render(scene, root, frames, args.pct, args.samples or 24, True, outdir, force=args.force,
             log_extra={'E': args.E, 'dist': args.dist, 'width': args.width})
    with open(os.path.join(outdir, 's02_params.json'), 'w') as fh:
        json.dump({'E': args.E, 'dist': args.dist, 'width': args.width, 'flip': args.flip, 'ghost_z_mm': GHOST_Z,
                   'ghost_x_mm': {f: round(ghost_x(f), 2) for f in (126, 150, 161, 170, 180, 186, 216)}}, fh, indent=1)


if __name__ == '__main__':
    main()
