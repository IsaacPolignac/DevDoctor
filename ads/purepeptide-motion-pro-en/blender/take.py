"""The one Cycles take f708–f1188 (S07 ARR → S08 wake → S09 dive/close → S10 tilt + slabs → S11 hero → S12 exit).
One scene, every pose keyed per frame (SHOTS §0.2 move/drift/arr_pose); render any range of it.

usage: PY blender/take.py --range 708-738 [--pass beauty|shadow] [--pct 100] [--samples 16] [--preview] [--force]
                          [--screen-seq assets/screen_seq] [--no-slabs] [--z]
outputs: renders/3d/take/{beauty,matte_phone,matte_cards,matte_screen,shadow}/####.png, corners.json, pose_speed.json,
         arr_glint.json, moves.json, log.json   (previews under renders/3d/take_prev/)
Samples per range (BRIEF §9) when --samples is not given: 24 inside f937–f1044 (slabs + DOF f/16), 16 elsewhere.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as C  # noqa: E402
import bpy  # noqa: E402

F0, F1 = 708, 1188
SEQ_DIR = os.path.join(C.ROOT, 'assets', 'screen_seq')
SEQ_COUNT, SEQ_OFFSET = 481, 707          # scr_0001 = f708

# slabs: name, capture, page rect (pt), screen centre (pt) at scroll 150, radius pt, lift mm, lift frame, seat frame
SLABS = [
    ('stepper', 'cart3', (113, 511, 132, 38), (179, 442), 19, 36.0, 954, 1030),
    ('total', 'cart3', (297, 553, 75, 28), (334.5, 479), 8, 24.0, 959, 1020),
    ('name', 'cart3', (113, 401, 149, 28), (187.5, 327), 8, 12.0, 964, 1025),
]
LIFT_F, SEAT_F, SETTLE_F = 20, 14, 4
ISLAND_Z_MM = 75.0 - 2.63 - 14 * 25.4 * 3 / 460 - 37 * 25.4 * 3 / 460 / 2    # the Dynamic Island centre (local z)
SLAB_BOX_MM = [(x, y, z) for x in (-37.0, 37.0) for y in (-52.0, 8.0) for z in (-75.5, 75.5)]   # phone + lifted slabs


def lift_curve(t):
    """expo.out with a 104 % overshoot that settles to 1.0."""
    e = C.expo_out(t)
    bump = math.sin(math.pi * min(max((t - 0.35) / 0.65, 0.0), 1.0)) ** 2 if t > 0.35 else 0.0
    return e + 0.04 * bump * (1 - t) ** 0.5 if t < 1 else 1.0


def build(scene, root, screen_seq=True, slabs_on=True):
    moves = {}
    # ------------------------------------------------------------------ screen
    if screen_seq and os.path.exists(os.path.join(SEQ_DIR, 'scr_0001.png')):
        C.screen_seq(SEQ_DIR, SEQ_COUNT, SEQ_OFFSET)
        moves['screen'] = 'SEQUENCE ' + SEQ_DIR
    else:
        C.screen(os.path.join(C.TYPE, 'screen_off.png'))
        moves['screen'] = 'BLACK (assets/screen_seq missing: test mode)'
        print('WARNING: assets/screen_seq/scr_0001.png missing → black screen', flush=True)
    C.screen_emission_key(F0, 1.0)
    C.screen_emission_key(1152, 1.0)
    C.screen_emission_key(1170, 0.0)              # DIM: the site goes dark, reflections stay
    # ------------------------------------------------------------------ poses
    glint = C.arr(root, F0)                        # f708–f738: ARR0 → REST exactly at f738
    moves['arr'] = {'f0': 708, 'f1': 738, 'glint_frame': glint}
    P = C.hold(root, 738, 750, C.REST)             # identity (the 2D fallback cut stays valid)
    P = C.drift(root, 750, 822, P, dspin=1.5, dloc=(0.002, 0, 0))          # the slow show: never static
    C.move(root, 822, 868, P, C.CLOSE)                                        # the dive
    moves['dive'] = {'f0': 822, 'f1': 868}
    P = C.move(root, 868, 936, C.CLOSE, (4.5, -3.0, -1.0, (0.0, -0.284, 0.006)), ease=lambda t: t)   # creep
    C.move(root, 936, 966, P, C.CARDS)                                        # the tilt
    moves['tilt'] = {'f0': 936, 'f1': 966}
    P = C.drift(root, 966, 1044, C.CARDS, dspin=2.0, dloc=(0.001, 0, 0))   # spin 14 → 16, x +1 mm
    P = C.drift(root, 1044, 1050, P, dspin=0.1)                              # hold-ish (≥ 0.5°/s rule)
    C.move(root, 1050, 1116, P, C.HERO)                                       # the pull-out / orbit
    moves['orbit'] = {'f0': 1050, 'f1': 1116}
    P = C.drift(root, 1116, 1152, C.HERO, dspin=1.5, dloc=(0, 0.010, 0))   # hero drift
    C.move(root, 1152, F1, P, C.EDGE)                                         # the exit → edge-on
    moves['exit'] = {'f0': 1152, 'f1': 1188}
    for k in ('dive', 'tilt', 'orbit', 'exit'):
        moves[k]['fastest_frame'] = C.fastest_frame(moves[k]['f0'] + 1, moves[k]['f1'])
    # ------------------------------------------------------------------ lights
    C.set_cold(F0)
    C.energy_key('Key', F0, 0.0)
    C.energy_key('Fill', F0, 0.0)
    C.energy_key('Key', 750, 0.0)
    C.energy_key('Fill', 750, 0.0)
    C.slow_show(750, 786)
    C.thermometer(803, 839)
    # SoftTop: at x 0 (built look) except the S10 crossing: fade out, jump left, fade in, cross f990–f1008, fade, return
    peak = C.softbox_peak('SoftTop')
    C.softtop_x_key(F0, 0.0)
    C.softbox_peak_key('SoftTop', F0, peak)
    C.softbox_peak_key('SoftTop', 966, peak)
    C.softbox_peak_key('SoftTop', 978, 0.0)
    C.softtop_x_key(978, 0.0)
    C.softtop_x_key(979, -0.30)
    C.softtop_x_key(990, -0.30)
    C.softbox_peak_key('SoftTop', 979, 0.0)
    C.softbox_peak_key('SoftTop', 990, peak)
    C.softtop_x_key(1008, 0.30)
    C.softbox_peak_key('SoftTop', 1008, peak)
    C.softbox_peak_key('SoftTop', 1018, 0.0)
    C.softtop_x_key(1018, 0.30)
    C.softtop_x_key(1019, 0.0)
    C.softbox_peak_key('SoftTop', 1019, 0.0)
    C.softbox_peak_key('SoftTop', 1044, peak)
    C.lights_out(1158, 1186)
    # ------------------------------------------------------------------ DOF
    C.dof(scene, root)
    C.dof_key(F0, False, 5.6, 0.0)
    C.dof_key(935, False, 16.0, 18.0)
    C.dof_key(936, True, 16.0, 18.0)                       # f/16, focus plane 18 mm in front of the display
    C.dof_key(1044, True, 16.0, 18.0)
    C.dof_key(1060, True, 5.6, 0.0, focus_xz=(0.0, ISLAND_Z_MM))   # f/5.6 on the Dynamic Island by f1060
    C.dof_key(1159, True, 5.6, 0.0, focus_xz=(0.0, ISLAND_Z_MM))
    C.dof_key(1160, False, 5.6, 0.0, focus_xz=(0.0, ISLAND_Z_MM))
    # ------------------------------------------------------------------ slabs
    slabs = []
    if slabs_on:
        for name, cap, rect, centre, rad, lift, f_lift, f_seat in SLABS:
            ob = C.slab(name, cap, rect, rad, centre, root=root)
            C.slab_key(ob, F0, 0.0, 1.0, visible=False)
            C.slab_key(ob, f_lift - 1, 0.0, 1.0, visible=False)
            C.slab_mix_key(ob, f_lift, 0.0)
            C.slab_mix_key(ob, f_lift + 6, 0.30)
            for f in range(f_lift, f_lift + LIFT_F + 1):
                t = (f - f_lift) / LIFT_F
                C.slab_key(ob, f, lift * lift_curve(t), 1.0 + 0.25 * C.expo_out(t), visible=True)
            for f in range(f_seat, f_seat + SEAT_F - SETTLE_F + 1):     # 10 f power3.in to the glass
                t = (f - f_seat) / (SEAT_F - SETTLE_F)
                e = C.power3_in(t)
                C.slab_key(ob, f, lift * (1 - e), 1.25 - 0.25 * e, visible=True)
            C.slab_mix_key(ob, f_seat + SEAT_F - SETTLE_F - 4, 0.30)
            C.slab_mix_key(ob, f_seat + SEAT_F - SETTLE_F, 0.0)
            for i in range(1, SETTLE_F + 1):                 # 4 f settle: a 0.4 mm bounce back onto the glass
                C.slab_key(ob, f_seat + SEAT_F - SETTLE_F + i, 0.4 * math.sin(math.pi * i / SETTLE_F), 1.0, visible=True)
            C.slab_key(ob, f_seat + SEAT_F + 1, 0.0, 1.0, visible=False)   # seated by f_seat + 14 (≤ f1044), then gone
            slabs.append(ob)
    scene.frame_set(F0)
    return moves, slabs


def samples_for(frames, requested):
    if requested:
        return requested
    return 24 if any(937 <= f <= 1044 for f in frames) else 16


def main():
    ap = C.cli('the take f708–f1188', default_range='%d-%d' % (F0, F1))
    ap.add_argument('--screen-seq', default=SEQ_DIR)
    ap.add_argument('--no-slabs', action='store_true')
    ap.add_argument('--z', action='store_true', help='also write the Z pass (float EXR)')
    args = C.apply_preview(ap.parse_args())
    globals()['SEQ_DIR'] = args.screen_seq
    C.lock()
    scene, root = C.load(F0, F1, denoise=not args.no_denoise)
    moves, slabs = build(scene, root, screen_seq=True, slabs_on=not args.no_slabs)
    outdir = C.outdir_for('take', args)
    os.makedirs(outdir, exist_ok=True)
    frames = C.parse_range(args.range)
    samples = samples_for(frames, args.samples)
    with open(os.path.join(outdir, 'moves.json'), 'w') as fh:
        json.dump(moves, fh, indent=1)
    with open(os.path.join(outdir, 'arr_glint.json'), 'w') as fh:
        json.dump({'glint_frame': moves['arr']['glint_frame'], 'note': 'edge-on frame of the ARR (|screen normal · camera| '
                   'minimal): the whoosh peak and the CA pass (±3 f) sit here'}, fh, indent=1)
    if args.exec:
        exec(args.exec, {'bpy': bpy, 'scene': scene, 'root': root, 'C': C, 'slabs': slabs})
    if args.pass_ == 'shadow':
        C.shadow_setup(scene, slabs)
        C.passes(scene, outdir, mattes=False, shadow=True)
        pct = 50 if args.pct == 100 else args.pct
        C.render(scene, root, frames, pct, args.samples or 16, False, outdir, force=args.force, label='shadow_rgba',
                 log_extra={'pass': 'shadow'})
        return
    C.passes(scene, outdir, mattes=True, z=args.z)
    box = SLAB_BOX_MM if any(940 <= f <= 1044 for f in frames) and not args.no_slabs else None
    C.render(scene, root, frames, args.pct, samples, True, outdir, force=args.force, box_mm=box)


if __name__ == '__main__':
    main()
