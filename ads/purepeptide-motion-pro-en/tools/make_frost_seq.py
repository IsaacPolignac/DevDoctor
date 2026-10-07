#!/usr/bin/env python3
"""S07 frost: a DLA (diffusion-limited aggregation) crystal field that grows from the four frame edges toward the
centre and closes over the vial's label (BRIEF §3.3, SHOTS S07).

    python3 tools/make_frost_seq.py [--walkers 100000] [--grid 1024x576] [--no-webm]

Outputs (all deterministic, seed 7):
    assets/fx/frost/frost_0001..0060.png   1920x1080 RGBA, straight alpha (frost_0001 = f648 = VO.w('L06', 0))
    assets/fx/frost/frost_full.png         frame 60, held f708-f738 (#frost-full) and multiplied into the phone's alpha (post_layers)
    assets/fx/frost/frost_density.json     per frame: new frost pixels (alpha-sum delta at 1080p), growth centroid, coverage
    assets/fx/frost.webm                   VP9 alpha, 30 fps, 2.000 s (data-start 21.6, mix-blend-mode: screen)

Method
    Grid 1024x576 (16:9; x1.875 -> exactly 1920x1080, the BRIEF's "1024 wide, x1.875" rule) with the 1-px border frozen
    as the seed. Walkers are born on a shell 6-10 cells away from the aggregate (birth-shell DLA: the harmonic measure
    still favours the tips, fjords stay screened), random-walk, touch when 4-adjacent to the aggregate (a cell freezes
    on its 3rd touch: noise reduction = frost-thick dendrites instead of hairline DLA) and die 22 cells away.
    Every cell records the step at which it froze; the run stops when the dendrite forest spans the frame (no free
    cell > 3 cells from a branch). That is the SKELETON. The 60 frames read it through a monotone time curve T(n):
    frames 1-9 slow (12 % of the way), a step on frame 10 (f657 "cold": the crackle hit), then a power curve that
    completes the skeleton on frame n_full. Every branch then grows an ICE HALO with its age (radius
    7 cells x (1 - exp(-age / tau))): the fill between the dendrites. (n_full, tau) are tuned automatically so the
    centre window (the label, stage 960x540 +/- 190x105 px) is closed (alpha > 0.5 on 99.9 % of it) exactly on
    frame 39 (f686 = VO.w('L06', 3)), preferring the slowest halo. Colour: white dendrite spines (widening with age)
    on #DCEBFF ice with a faint seeded crystalline speckle; alpha = the halo union.
    Upscale x1.875 (bicubic on float), 2 px Gaussian blur.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "fx" / "frost"
WEBM = ROOT / "assets" / "fx" / "frost.webm"
SEED = 7
W, H = 1920, 1080
N_FRAMES = 60
F0 = 648                          # frost_0001 = f648
F_CLOSE = 686                     # the centre is closed on this frame (frame index 39)
F_COLD = 657                      # the crackle hit: a density step (frame index 10)
CENTRE = (960, 540, 190, 105)     # stage centre window (cx, cy, half-w, half-h) = the label region of the held macro
WHITE = np.array([255, 255, 255], float)
ICE = np.array([0xDC, 0xEB, 0xFF], float)


INF = np.iinfo(np.int32).max


def dla(gw: int, gh: int, walkers: int, seed: int, r_birth: float = 6.0, r_kill: float = 22.0, hits: int = 3,
        edt_every: int = 60, r_stop: float = 3.0) -> np.ndarray:
    """Freeze-step per cell (int32; 0 = seed border). Lattice DLA, vectorised over a few thousand concurrent walkers:
    a walker is born on a shell r_birth .. r_birth + 4 cells from the aggregate (birth-shell DLA: the harmonic measure
    still favours the tips, fjords stay screened), random-walks 4-connected, touches when 4-adjacent to the aggregate
    (the cell freezes after `hits` touches: noise reduction = frost-thick dendrites instead of hairline DLA) and is
    killed beyond r_kill and reborn. The shell follows the aggregate (EDT every `edt_every` steps; the growth between
    two updates is a tiny fraction of the shell). The run stops when the dendrite forest spans the frame (no free cell
    farther than r_stop from a branch): the skeleton. Cells never reached hold INF (the ice halo fills them later)."""
    from scipy.ndimage import distance_transform_edt
    r = np.random.default_rng(seed)
    frozen = np.zeros((gh, gw), bool)
    frozen[0, :] = frozen[-1, :] = frozen[:, 0] = frozen[:, -1] = True
    step_of = np.full((gh, gw), INF, np.int32)
    step_of[frozen] = 0
    touch = np.zeros((gh, gw), np.int16)
    sticky = np.zeros((gh, gw), bool)
    dy4 = np.array([-1, 1, 0, 0]); dx4 = np.array([0, 0, -1, 1])

    def mark_sticky(ys, xs):
        for dy, dx in zip(dy4, dx4):
            sticky[np.clip(ys + dy, 0, gh - 1), np.clip(xs + dx, 0, gw - 1)] = True
        sticky[ys, xs] = False

    ys0, xs0 = np.nonzero(frozen)
    mark_sticky(ys0, xs0)
    k = walkers
    ys = np.zeros(k, np.int64); xs = np.zeros(k, np.int64)
    alive = np.zeros(k, bool)
    dist = shell = None
    step, t0, total = 0, time.time(), gw * gh
    while True:
        step += 1
        if dist is None or step % edt_every == 0:
            dist = distance_transform_edt(~frozen)
            dmax = float(dist.max())
            if dmax < r_stop:                               # the forest spans the frame: the skeleton is done
                break
            r1 = min(r_birth, 0.55 * dmax)
            shell = np.flatnonzero((dist >= r1) & (dist <= r1 + 4.0))
        # 1. walkers on sticky cells touch; `hits` touches freeze the cell
        st = sticky[ys, xs] & alive
        if st.any():
            fy, fx = ys[st], xs[st]
            np.add.at(touch, (fy, fx), 1)
            fz = touch[fy, fx] >= hits
            if fz.any():
                fy, fx = fy[fz], fx[fz]
                new = ~frozen[fy, fx]
                frozen[fy, fx] = True
                step_of[fy[new], fx[new]] = step
                mark_sticky(fy, fx)
            alive[st] = False                               # a walker that touched is spent (stuck or absorbed)
        # 2. kill the ones that wandered off or sit on the aggregate; everything dead is reborn on the shell
        alive &= ~((dist[ys, xs] > r_kill) | frozen[ys, xs])
        dead = ~alive
        if dead.any():
            pick = r.choice(shell, int(dead.sum()))
            ys[dead], xs[dead] = pick // gw, pick % gw
            alive[dead] = True
        moving = ~dead                                      # the newborn are checked before they move
        # 3. one random 4-step for the walkers that were already alive
        d = r.integers(0, 4, k)
        ys = np.where(moving, np.clip(ys + dy4[d], 0, gh - 1), ys)
        xs = np.where(moving, np.clip(xs + dx4[d], 0, gw - 1), xs)
        if step % 2000 == 0:
            print(f"  step {step:6d}  frozen {100 * frozen.mean():6.2f} %  {time.time() - t0:6.1f} s", file=sys.stderr)
    print(f"  DLA done: {step} steps, skeleton {100 * frozen.mean():.1f} % of the cells, {time.time() - t0:.1f} s", file=sys.stderr)
    return step_of


def skel_curve(s_max: int, n_full: int) -> np.ndarray:
    """T(n), n = 1..60: the skeleton freeze-step threshold shown on frame n (frame 1 = f648). Slow start (frames 1-9,
    12 % of the way), a step on frame 10 (f657 "cold": the crackle hit), then a power curve that completes the
    skeleton on frame n_full; flat after."""
    n_cold = F_COLD - F0 + 1
    T = np.zeros(N_FRAMES + 1)
    for n in range(1, N_FRAMES + 1):
        if n < n_cold:
            u = 0.12 * (n / (n_cold - 1)) ** 1.3
        elif n <= n_full:
            v = (n - n_cold) / (n_full - n_cold)
            u = 0.20 + 0.80 * v ** 1.25
        else:
            u = 1.0
        T[n] = u * s_max
    return T


def halo_radius(age: np.ndarray, tau: float, r_max: float) -> np.ndarray:
    return r_max * (1.0 - np.exp(-np.maximum(age, 0.0) / tau))


AGE_BANDS = [0, 1, 2, 3, 4, 6, 8, 11, 15, 20, 28, 40]


def frame_fields(n_freeze: np.ndarray, n: int, tau: float, r_max: float, edt):
    """(alpha, core) at grid resolution for frame n: alpha = the union of the branches' ice halos (radius grows with
    the branch's age in frames), core = the white dendrite spine (widening slowly with age)."""
    gh, gw = n_freeze.shape
    alpha = np.zeros((gh, gw))
    core = np.zeros((gh, gw))
    age = (n - n_freeze).astype(float)                       # < 0: not yet frozen
    for a in AGE_BANDS:
        m = age >= a
        if not m.any():
            break
        d = edt(~m)
        R = halo_radius(float(a), tau, r_max)
        alpha = np.maximum(alpha, np.clip((R - d + 1.0) / 1.5, 0.0, 1.0))
        core = np.maximum(core, np.clip((0.55 + 0.02 * min(a, 30) - d) / 0.9, 0.0, 1.0))
    return alpha, core


def centre_window(gw: int, gh: int):
    sx, sy = gw / W, gh / H
    cx, cy, hw, hh = CENTRE
    return slice(int((cy - hh) * sy), int((cy + hh) * sy)), slice(int((cx - hw) * sx), int((cx + hw) * sx))


def tune(step_of: np.ndarray, edt) -> tuple[np.ndarray, np.ndarray, float, int]:
    """Pick (n_full, tau) so the centre window closes (alpha > 0.5 on 99.9 % of it) exactly on F_CLOSE, preferring the
    slowest halo (the most dendritic look) and the latest skeleton completion."""
    gh, gw = step_of.shape
    fin = step_of[step_of < INF]
    s_max = int(fin.max())
    n_close = F_CLOSE - F0 + 1
    win = centre_window(gw, gh)
    best = None
    for n_full in (35, 34, 33, 32, 31, 30, 29, 28):
        T = skel_curve(s_max, n_full)
        n_freeze = np.searchsorted(T[1:], step_of, side="left") + 1     # first frame whose threshold reaches the cell
        n_freeze = np.where(step_of >= INF, 10 ** 6, n_freeze)
        for tau in (14.0, 12.0, 10.0, 8.5, 7.0, 6.0, 5.0, 4.0, 3.0, 2.0):
            def closed(n):
                a, _ = frame_fields(n_freeze, n, tau, R_MAX, edt)
                return (a[win] > 0.5).mean() >= 0.999
            if closed(n_close) and not closed(n_close - 1):
                best = (T, n_freeze, tau, n_full)
                break
        if best:
            break
    if best is None:                                              # fall back: closest achievable
        T = skel_curve(s_max, 30)
        n_freeze = np.where(step_of >= INF, 10 ** 6, np.searchsorted(T[1:], step_of, side="left") + 1)
        best = (T, n_freeze, 3.0, 30)
    return best


R_MAX = 7.0


def render_frame(alpha_g: np.ndarray, core_g: np.ndarray, speckle: np.ndarray) -> np.ndarray:
    """Grid-space alpha + spine -> 1920x1080 RGBA uint8 (bicubic upscale, 2 px blur, speckle in the ice)."""
    tone = core_g[..., None] * WHITE + (1 - core_g[..., None]) * ICE
    tone = tone * (1.0 - 0.16 * speckle[..., None] * (1 - core_g[..., None]))      # crystalline speckle in the ice only
    alpha_g = alpha_g * (0.93 + 0.07 * core_g)                                       # the ice between the spines is a hair thinner
    rgb = np.dstack([np.asarray(Image.fromarray(tone[..., c].astype(np.float32)).resize((W, H), Image.BICUBIC)) for c in range(3)])
    a = np.asarray(Image.fromarray(alpha_g.astype(np.float32)).resize((W, H), Image.BICUBIC))
    rgb = gaussian_filter(rgb.astype(np.float64), sigma=(2.0, 2.0, 0.0))
    a = gaussian_filter(a.astype(np.float64), sigma=2.0)
    out = np.empty((H, W, 4), np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255).round().astype(np.uint8)
    out[..., 3] = (np.clip(a, 0, 1) * 255).round().astype(np.uint8)
    return out


def main() -> None:
    from scipy.ndimage import distance_transform_edt as edt
    ap = argparse.ArgumentParser()
    ap.add_argument("--walkers", type=int, default=3000)
    ap.add_argument("--grid", default="1024x576")
    ap.add_argument("--no-webm", action="store_true")
    args = ap.parse_args()
    gw, gh = (int(v) for v in args.grid.split("x"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cache = OUT_DIR / "_dla_steps.npy"
    step_of = np.load(cache) if cache.exists() else None
    if step_of is None or step_of.shape != (gh, gw):
        print(f"DLA {gw}x{gh}, {args.walkers} walkers, seed {SEED}", file=sys.stderr)
        step_of = dla(gw, gh, args.walkers, SEED)
        np.save(cache, step_of)
    T, n_freeze, tau, n_full = tune(step_of, edt)
    print(f"tuned: skeleton complete on frame {n_full} (f{F0 + n_full - 1}), halo tau {tau} frames, r_max {R_MAX} cells",
          file=sys.stderr)
    speckle = np.random.default_rng(SEED + 1).random((gh, gw)) ** 18
    cx, cy, hw, hh = CENTRE
    dens, prev_sum, prev = [], 0.0, None
    yy, xx = np.mgrid[0:H, 0:W]
    for n in range(1, N_FRAMES + 1):
        a_g, c_g = frame_fields(n_freeze, n, tau, R_MAX, edt)
        fr = render_frame(a_g, c_g, speckle)
        Image.fromarray(fr, "RGBA").save(OUT_DIR / f"frost_{n:04d}.png", compress_level=6)
        a = fr[..., 3] / 255.0
        s = float(a.sum())
        new = np.clip(a - (prev if prev is not None else 0.0), 0, None)
        wsum = float(new.sum())
        c = a[cy - hh:cy + hh, cx - hw:cx + hw]
        dens.append({
            "frame": n, "f": F0 + n - 1, "T": round(float(T[n]), 1),
            "new_px": round(s - prev_sum, 1),
            "centroid": [round(float((new * xx).sum() / wsum), 1), round(float((new * yy).sum() / wsum), 1)] if wsum > 1 else None,
            "coverage": round(s / (W * H), 4),
            "centre_cov": round(float((c > 0.5).mean()), 4),
            "centre_alpha": round(float(c.mean()), 4),
        })
        prev_sum, prev = s, a
        print(f"  frame {n:2d} f{F0 + n - 1}  new {dens[-1]['new_px']:9.0f}  cov {dens[-1]['coverage']:.3f}  "
              f"centre {dens[-1]['centre_cov']:.3f}/{dens[-1]['centre_alpha']:.3f}", file=sys.stderr)
    Image.fromarray(fr, "RGBA").save(OUT_DIR / "frost_full.png", compress_level=6)
    meta = {"note": "S07 frost (tools/make_frost_seq.py, DLA seed 7). frame n = film frame f0 + n - 1; new_px = alpha-sum "
                    "delta at 1080p (pixel units) -> SFX crackle density; centroid = stage px of the new frost (pan); "
                    "centre_cov = fraction of the label window (960,540 +/- 190x105) with alpha > 0.5",
            "f0": F0, "fps": 30, "frames": N_FRAMES, "grid": [gw, gh], "walkers": args.walkers, "hits": 3,
            "skeleton_full_frame": F0 + n_full - 1, "halo_tau_frames": tau, "halo_r_max_cells": R_MAX,
            "close_frame": next((d["f"] for d in dens if d["centre_cov"] >= 0.999), None),
            "full_frame": next((d["f"] for d in dens if d["coverage"] >= 0.99), None),
            "density": dens}
    (OUT_DIR / "frost_density.json").write_text(json.dumps(meta, indent=1))
    print(f"centre closed (cov >= 0.999) on f{meta['close_frame']} (target f{F_CLOSE} +/- 2); field >= 0.99 on f{meta['full_frame']}",
          file=sys.stderr)
    if not args.no_webm:
        cmd = ["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-start_number", "1", "-i", str(OUT_DIR / "frost_%04d.png"),
               "-frames:v", str(N_FRAMES), "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "18",
               "-row-mt", "1", "-auto-alt-ref", "0", str(WEBM)]
        subprocess.run(cmd, check=True)
        print(f"wrote {WEBM.relative_to(ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
