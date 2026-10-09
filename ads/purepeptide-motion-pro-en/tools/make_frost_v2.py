#!/usr/bin/env python3
"""S07 frost, v2: studio-macro window frost (fern / feather dendrites), grown from the four frame edges to the centre.

    python3 tools/make_frost_v2.py [--out DIR] [--seed 11] [--front-frame 32] [--close-frame 37] [--qc] [--qc-only]
                                   [--phone-frames 738,760]

Outputs (deterministic: every random number comes from numpy's seeded Generator; ~2.5 min on 4 CPUs):
    DIR/frost_0001..0060.png   1920x1080 RGBA, straight alpha = coverage (frost_0001 = f648 = VO.w('L06', 0))
    DIR/frost_full.png         frame 60, held f708-f738 and used on the phone by tools/post_layers.py
    DIR/frost_density.json     per frame: new frost pixels (alpha-sum delta), centroid, coverage, centre numbers
    --qc adds:  contact.png (frames 10/20/30/40/50/60 screened over assets/plates/macro_last.png the way the
                browser composites mix-blend-mode: screen on an RGBA element: C = B + L (1 - B), L = rgb * alpha),
                crop45_x4.png / crop45_x4_black.png (frame 45, a 480x270 window at 4x, nearest), phone_<f>.png
                (take frames recomposited with the proposed post_layers step 2, `phone_frost`, over black) and
                phone_<f>_crop.png (the phone at 2x).
    DIR defaults to the session scratchpad; nothing under assets/ or renders/ is written.

The look (why it is not the v1 DLA)
    Real frost on glass is a forest of FEATHERS: a main stem with side branches on both sides at ~60 deg (hexagonal
    ice), each side branch carrying smaller needles at 60 deg, and the feathers stop where they meet. Between the
    branches the ice is a translucent haze that thickens with age, so a frosted window is never a white-out: the
    scene stays readable through the thin ice and only the dense feather bodies go white. The v1 DLA gives
    hairline random-walk aggregates of a single scale under a flat 96 % alpha ("crumpled paper").

Method
    1. GROWTH SIM (full-res coordinates, a territory grid at 1/2 res, ~4 s). Tips carry (x, y, heading, class,
       branch id, parent branch id, width, speed, remaining length, curvature, wobble). Classes: 0 trunk (6 px/step,
       2.6 px wide, 400-1200 px), 1 secondary (3.6 px/step, 1.5 px, 40-360 px), 2 tertiary (2.4, 0.6, 3-12 px),
       3 hair (1.8, 0.45, 2-5 px). Every `spacing` px (trunk 7-11, secondary 4.5-7.5, tertiary 3-5) a tip spawns a
       child at +-(54..66) deg (the angle is per tree; sides alternate; 35 % of the trees spawn both sides at once
       = symmetric feathers), the child bending slightly back toward its parent's heading. A tip dies when its
       length is spent, when it leaves the frame, or when it enters the territory (a disc of 3/2/1/1 cells around
       every drawn point) of a branch that is neither itself, its parent nor its own child: fans stop where they
       meet. Trunks are born on the four frame edges (every ~26 px, heading = inward normal +-22 deg, side edges
       x1.2 speed, start steps spread over the first 60 steps so the front stays ragged). From step 6 on, ferns
       nucleate on free cells touching the ice, heading away from it (20 % trunk-class, 50 % secondary-class, 30 %
       needle-class): the gap filler, always connected to the front. The sim stops once 99.7 % of the cells are
       within one cell of ice. Every drawn segment keeps its sim step.
    2. TIME CURVE. On the 3x3-min-filtered occupancy map of the label window (stage 960x540 +-190x105):
       s_front = the step on which half of it is iced, s_close = 99 % of it. T(n) maps the 60 frames onto sim
       steps: frames 1-9 creep at the edges (12 % of s_front), a step on frame 10 (f657 "cold", the crackle hit),
       a power curve brings the front to the window on --front-frame (32 = f679), the window closes on
       --close-frame (37 = f684), the remaining steps settle over the next 9 frames, flat after (the ice keeps
       thickening). Enclosed pockets the growth never reached ice over right after their surroundings (the
       neighbouring freeze step is propagated inward, 7x7 max filter, 4 passes).
    3. RENDER per frame (~2 s): the frame's new segments are drawn as anti-aliased polylines (PIL at 2x, sub-pixel
       widths carried as intensity, box-filtered down) into the coverage map; each pixel keeps its birth frame.
       Crystals fade in over 2 frames and thicken with age (tau 5). The ICE = territory age (1 - exp(-(age+1)/4))
       x a per-tree density (0.7-1.0) x (0.6 + 0.4 x the branch density at 1.5/4/10 px: feather bodies go dense)
       x a low-frequency patch field (0.8-1.0) x a static micro-crystal grain (+-12 %) plus static bright specks.
       An emboss relief (normals of the height field, lit from the upper left = the studio key) shades the ice
       body 0.60-1.00 and the spines 0.78-1.00. Light (the premultiplied frost L = rgb x alpha): crystals 0.80 x
       relief, #DCEBFF -> white in the dense cores; ice 1.0 x ice x relief in #BFD7F5 -> #DCEBFF; bloom = 0.5 x
       gaussian(lum - 0.3, 10 px); the sum is clipped at 0.82; then the sparkles: seeded candidate pixels (0.6 % of
       the crystal pixels, 0.06 % of the ice), each with its own phase and rate, intensity sin^8 (twinkle, 30 % of
       them near-steady), a 1 px point with a soft cross and glow up to 1.0. Alpha = union(crystal, 0.9 x ice),
       raised to the light where the light exceeds it; rgb = L / alpha (straight alpha).
    Result (seed 11): field light p50 0.61 / p99 0.82; label window light 0.44 on f686 and 0.59 on the hold (the
    vial reads through the ice at ~40 %); the window's mean alpha passes 0.5 on f685.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import (binary_dilation, binary_fill_holes, distance_transform_edt, gaussian_filter, maximum_filter,
                           minimum_filter)

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = Path("/tmp/claude-0/-home-user-DevDoctor/ca67d510-2d8b-5e0f-8cd7-0607b6bf90ac/scratchpad/frost_v2")
W, H = 1920, 1080
SS = 2                              # supersampling of the line rasteriser
TG = 2                              # territory grid cell (px)
GW, GH = W // TG, H // TG
N_FRAMES = 60
F0 = 648
F_COLD = 657
CENTRE = (960, 540, 190, 105)
WHITE = np.array([1.0, 1.0, 1.0], np.float32)
ICE = np.array([0xDC, 0xEB, 0xFF], np.float32) / 255.0       # #DCEBFF
ICE2 = np.array([0xBF, 0xD7, 0xF5], np.float32) / 255.0      # #BFD7F5
PEAK = 0.80                                                  # peak light of the field (sparkles excepted)

# class table: 0 trunk, 1 secondary, 2 tertiary, 3 hair
C_SPEED = np.array([6.0, 3.6, 2.4, 1.8], np.float32)
C_WIDTH = np.array([2.6, 1.5, 0.6, 0.45], np.float32)
C_LEN = np.array([[400.0, 1200.0], [40.0, 360.0], [3.0, 12.0], [2.0, 5.0]], np.float32)
C_SPACING = np.array([[7.0, 11.0], [4.5, 7.5], [3.0, 5.0], [1.0, 1.0]], np.float32)
C_TERR = [3, 2, 1, 1]
C_SPAWN_P = np.array([1.0, 1.0, 0.2, 0.0], np.float32)
BRANCH_ANGLE = math.radians(60.0)
MAX_TIPS = 160_000
MAX_BRANCHES = 6_000_000


def disc_offsets(r: int) -> tuple[np.ndarray, np.ndarray]:
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    m = yy * yy + xx * xx <= r * r + 0.5
    return yy[m].ravel(), xx[m].ravel()


class Tips:
    """Structure-of-arrays tip population."""
    F = ("x", "y", "ang", "w0", "spd", "left", "lmax", "curv", "wob", "since", "spacing")
    I = ("cls", "tree", "bid", "pbid", "side", "start", "both")

    def __init__(self, **kw):
        n = len(kw["x"])
        for k in self.F:
            setattr(self, k, np.asarray(kw[k], np.float32).reshape(n))
        for k in self.I:
            setattr(self, k, np.asarray(kw[k], np.int32).reshape(n))

    def __len__(self):
        return len(self.x)

    def keep(self, m):
        return Tips(**{k: getattr(self, k)[m] for k in self.F + self.I})

    @staticmethod
    def cat(a: "Tips", b: "Tips") -> "Tips":
        return Tips(**{k: np.concatenate([getattr(a, k), getattr(b, k)]) for k in Tips.F + Tips.I})


def log_uniform(rng, lo, hi, n):
    return np.exp(rng.uniform(np.log(lo), np.log(hi), n)).astype(np.float32)


class Sim:
    def __init__(self, seed: int):
        self.rng = np.random.default_rng(seed)
        self.terr = np.zeros((GH, GW), np.int32)            # branch id per cell, 0 = free
        self.terr_step = np.full((GH, GW), 10 ** 6, np.int32)
        self.pb_of = np.zeros(MAX_BRANCHES, np.int32)       # parent branch id per branch id
        self.tree_of = np.zeros(MAX_BRANCHES, np.int32)
        self.next_bid = 1
        self.tree_haze = [1.0]                              # per tree: haze density factor (index 0 unused)
        self.tree_both = [0]
        self.tree_spmul = [1.0]
        self.tree_wob = [0.02]
        self.tree_bang = [BRANCH_ANGLE]
        self.discs = [disc_offsets(r) for r in C_TERR]
        self.segs = []                                      # per step: (x0, y0, x1, y1, w, cls, step)
        self.tips = None

    # --- creation -----------------------------------------------------------------------------------------------
    def new_tree(self, n):
        r = self.rng
        ids = np.arange(len(self.tree_haze), len(self.tree_haze) + n, dtype=np.int32)
        self.tree_haze += list(r.uniform(0.70, 1.0, n))
        self.tree_both += list((r.random(n) < 0.35).astype(int))
        self.tree_spmul += list(r.uniform(0.8, 1.3, n))
        self.tree_wob += list(r.uniform(0.012, 0.04, n))
        self.tree_bang += list(r.uniform(math.radians(54), math.radians(66), n))
        return ids

    def make_tips(self, x, y, ang, cls, tree, pbid, start, spd_mul, curv=None, side=None):
        n = len(x)
        r = self.rng
        cls = np.asarray(cls, np.int32)
        bid = np.arange(self.next_bid, self.next_bid + n, dtype=np.int32)
        self.next_bid += n
        self.pb_of[bid] = pbid
        self.tree_of[bid] = tree
        lmax = np.exp(r.uniform(np.log(C_LEN[cls, 0]), np.log(C_LEN[cls, 1]))).astype(np.float32)
        spmul = np.asarray(self.tree_spmul, np.float32)[tree]
        spacing = r.uniform(C_SPACING[cls, 0], C_SPACING[cls, 1]).astype(np.float32) * spmul
        if curv is None:
            curv = r.normal(0.0, 0.0012, n).astype(np.float32)
        if side is None:
            side = r.choice(np.array([-1, 1], np.int32), n)
        both = np.asarray(self.tree_both, np.int32)[tree]
        wob = np.asarray(self.tree_wob, np.float32)[tree] * np.where(cls == 0, 1.0, 0.7).astype(np.float32)
        return Tips(x=x, y=y, ang=ang, w0=C_WIDTH[cls], spd=C_SPEED[cls] * spd_mul, left=lmax, lmax=lmax,
                    curv=curv, wob=wob, since=np.zeros(n), spacing=spacing, cls=cls, tree=tree, bid=bid,
                    pbid=pbid, side=side, start=start, both=both)

    def seed_edges(self):
        r = self.rng
        xs, ys, angs, mul = [], [], [], []
        for edge in ("top", "bottom", "left", "right"):
            L = W if edge in ("top", "bottom") else H
            pos = np.cumsum(r.exponential(26.0, int(L / 26.0 * 1.6)))
            pos = pos[(pos > 6) & (pos < L - 6)]
            n = len(pos)
            jit = r.uniform(-math.radians(22), math.radians(22), n)
            if edge == "top":
                xs.append(pos); ys.append(np.full(n, 1.0)); angs.append(math.pi / 2 + jit); mul.append(np.ones(n))
            elif edge == "bottom":
                xs.append(pos); ys.append(np.full(n, H - 2.0)); angs.append(-math.pi / 2 + jit); mul.append(np.ones(n))
            elif edge == "left":
                xs.append(np.full(n, 1.0)); ys.append(pos); angs.append(0.0 + jit); mul.append(np.full(n, 1.2))
            else:
                xs.append(np.full(n, W - 2.0)); ys.append(pos); angs.append(math.pi + jit); mul.append(np.full(n, 1.2))
        x = np.concatenate(xs).astype(np.float32); y = np.concatenate(ys).astype(np.float32)
        ang = np.concatenate(angs).astype(np.float32); mul = np.concatenate(mul).astype(np.float32)
        n = len(x)
        tree = self.new_tree(n)
        early = r.random(n) < 0.6
        start = np.where(early, r.integers(0, 12, n), r.integers(12, 60, n)).astype(np.int32)
        spd_mul = (mul * r.uniform(0.75, 1.3, n)).astype(np.float32)
        self.tips = self.make_tips(x, y, ang, np.zeros(n, np.int32), tree, np.zeros(n, np.int32), start, spd_mul)
        print(f"  seeded {n} trunks on the four edges", file=sys.stderr)

    def nucleate(self, s: int):
        """Small ferns on free cells touching the ice, heading away from it (the gap filler)."""
        r = self.rng
        occ = self.terr != 0
        bnd = ~occ & binary_dilation(occ, np.ones((3, 3), bool))
        idx = np.flatnonzero(bnd)
        if len(idx) == 0:
            return None
        k = int(min(100, max(10, len(idx) / 300.0)))
        pick = r.choice(idx, k, replace=False)
        cy, cx = pick // GW, pick % GW
        g = gaussian_filter(occ.astype(np.float32), 2.0)
        gy, gx = np.gradient(g)
        ang = (np.arctan2(-gy[cy, cx], -gx[cy, cx]) + r.normal(0, math.radians(30), k)).astype(np.float32)
        u = r.random(k)
        cls = np.where(u < 0.2, 0, np.where(u < 0.7, 1, 2)).astype(np.int32)
        tree = self.new_tree(k)
        x = (cx * TG + r.uniform(0, TG, k)).astype(np.float32)
        y = (cy * TG + r.uniform(0, TG, k)).astype(np.float32)
        t = self.make_tips(x, y, ang, cls, tree, np.zeros(k, np.int32), np.full(k, s, np.int32),
                           (r.uniform(0.8, 1.2, k) * np.where(cls == 0, 0.8, 1.0)).astype(np.float32))
        self.terr[cy, cx] = t.bid                              # the nucleus itself
        self.terr_step[cy, cx] = np.minimum(self.terr_step[cy, cx], s)
        return t

    # --- one step ----------------------------------------------------------------------------------------------
    def step(self, s: int):
        t = self.tips
        r = self.rng
        n = len(t)
        active = t.start <= s
        d = t.spd * r.uniform(0.85, 1.15, n).astype(np.float32)
        ang = t.ang + t.curv * d + t.wob * r.normal(0, 1, n).astype(np.float32) * np.sqrt(d)
        nx = t.x + np.cos(ang) * d
        ny = t.y + np.sin(ang) * d
        inside = (nx >= 0) & (nx < W - 1) & (ny >= 0) & (ny < H - 1)
        cx = np.clip((nx / TG).astype(np.int32), 0, GW - 1); cy = np.clip((ny / TG).astype(np.int32), 0, GH - 1)
        mx = np.clip(((t.x + nx) * 0.5 / TG).astype(np.int32), 0, GW - 1)
        my = np.clip(((t.y + ny) * 0.5 / TG).astype(np.int32), 0, GH - 1)
        blocked = np.zeros(n, bool)
        for (yy, xx) in ((cy, cx), (my, mx)):
            occ = self.terr[yy, xx]
            blocked |= (occ != 0) & (occ != t.bid) & (occ != t.pbid) & (self.pb_of[occ] != t.bid)
        ok = active & inside & ~blocked
        if ok.any():
            w = t.w0 * (0.4 + 0.6 * np.clip(t.left / t.lmax, 0, 1) ** 0.7)
            self.segs.append((t.x[ok].copy(), t.y[ok].copy(), nx[ok].copy(), ny[ok].copy(), w[ok].copy(),
                              t.cls[ok].copy(), np.full(int(ok.sum()), s, np.int32)))
            for c in range(4):
                sel = ok & (t.cls == c)
                if not sel.any():
                    continue
                oy, ox = self.discs[c]
                yy = np.clip(cy[sel][:, None] + oy[None, :], 0, GH - 1).ravel()
                xx = np.clip(cx[sel][:, None] + ox[None, :], 0, GW - 1).ravel()
                bb = np.repeat(t.bid[sel], len(oy))
                free = self.terr[yy, xx] == 0
                self.terr[yy[free], xx[free]] = bb[free]
                self.terr_step[yy[free], xx[free]] = s
        t.x = np.where(ok, nx, t.x); t.y = np.where(ok, ny, t.y); t.ang = np.where(ok, ang, t.ang)
        t.left = np.where(ok, t.left - d, t.left)
        t.since = np.where(ok, t.since + d, t.since)
        dead = active & (~ok | (t.left <= 0))
        # spawn side branches
        children = None
        if n < MAX_TIPS:
            sp = ok & (t.since >= t.spacing) & (t.cls < 3) & (r.random(n) < C_SPAWN_P[t.cls])
            if sp.any():
                idx = np.flatnonzero(sp)
                sides = [t.side[idx]]
                src = [idx]
                b2 = t.both[idx] == 1
                if b2.any():
                    sides.append(-t.side[idx][b2]); src.append(idx[b2])
                src = np.concatenate(src); side = np.concatenate(sides).astype(np.int32)
                k = len(src)
                bang = np.asarray(self.tree_bang, np.float32)[t.tree[src]]
                cang = (t.ang[src] + side * bang + r.normal(0, math.radians(4), k)).astype(np.float32)
                ccls = np.minimum(t.cls[src] + 1, 3).astype(np.int32)
                curv = (-side * np.abs(r.normal(0, 0.0025, k))).astype(np.float32)
                children = self.make_tips(t.x[src], t.y[src], cang, ccls, t.tree[src], t.bid[src],
                                          np.full(k, s + 1, np.int32), r.uniform(0.9, 1.1, k).astype(np.float32),
                                          curv=curv, side=-side)
                t.since[idx] = 0.0
                t.side[idx] = -t.side[idx]
        t = t.keep(~dead)
        if children is not None:
            t = Tips.cat(t, children)
        self.tips = t

    def run(self, max_steps=900):
        t0 = time.time()
        self.seed_edges()
        free_hist = []
        s = 0
        while s < max_steps:
            if s >= 6:
                nt = self.nucleate(s)
                if nt is not None:
                    self.tips = Tips.cat(self.tips, nt)
            self.step(s)
            free = int((self.terr == 0).sum())
            free_hist.append(free)
            if s % 10 == 0:
                closed = binary_dilation(self.terr != 0, np.ones((3, 3), bool)).mean()
                if closed >= 0.997:
                    s += 1
                    break
            if s % 25 == 0:
                print(f"  step {s:4d}  tips {len(self.tips):7d}  occupied {100 * (1 - free / (GW * GH)):6.2f} %  "
                      f"segs {sum(len(q[0]) for q in self.segs):8d}  {time.time() - t0:5.1f} s", file=sys.stderr)
            s += 1
            if s > 80 and (free_hist[-40] - free_hist[-1]) < 0.001 * GW * GH:
                break
            if s > 80 and free_hist[-1] < 0.0005 * GW * GH:
                break
        self.s_end = s - 1
        print(f"  sim done: {s} steps, occupied {100 * (1 - free_hist[-1] / (GW * GH)):.2f} %, "
              f"{sum(len(q[0]) for q in self.segs)} segments, {time.time() - t0:.1f} s", file=sys.stderr)
        cols = [np.concatenate([q[i] for q in self.segs]) for i in range(7)]
        return cols


# --- time curve -------------------------------------------------------------------------------------------------
def time_curve(s_front: float, s_close: float, s_end: float, n_front: int, n_close: int) -> np.ndarray:
    """Sim-step threshold per frame. Frames 1-9: slow creep at the edges (12 % of the way to the front's arrival);
    frame 10 (f657 "cold"): a step to 20 %; a power curve brings the front to the label window on n_front; the
    window closes (99 % of it iced) on n_close; the last pockets settle over the next 9 frames; flat after."""
    n_cold = F_COLD - F0 + 1                     # 10
    T = np.zeros(N_FRAMES + 1)
    for n in range(1, N_FRAMES + 1):
        if n < n_cold:
            T[n] = 0.12 * (n / (n_cold - 1)) ** 1.3 * s_front
        elif n <= n_front:
            v = (n - n_cold) / (n_front - n_cold)
            T[n] = (0.20 + 0.80 * v ** 1.25) * s_front
        elif n <= n_close:
            v = (n - n_front) / (n_close - n_front)
            T[n] = s_front + (s_close - s_front) * v ** 1.3
        elif n <= n_close + 9:
            v = (n - n_close) / 9.0
            T[n] = s_close + (s_end - s_close) * v ** 0.8
        else:
            T[n] = s_end
    return T


def frame_of_step(step: np.ndarray, T: np.ndarray) -> np.ndarray:
    """First frame n with T[n] >= step (1..60); 255 when never reached."""
    n = np.searchsorted(T[1:], step, side="left") + 1
    return np.where(n > N_FRAMES, 255, n).astype(np.int32)


# --- rasteriser -------------------------------------------------------------------------------------------------
def draw_segments(x0, y0, x1, y1, w) -> np.ndarray:
    """Anti-aliased polylines at 1x: PIL at SSx with round caps, box-filtered down. Returns float32 0..1."""
    im = Image.new("L", (W * SS, H * SS), 0)
    dr = ImageDraw.Draw(im)
    for a, b, c, d, ww in zip(x0 * SS, y0 * SS, x1 * SS, y1 * SS, w * SS):
        if ww < 2.0:                                   # hairline: 1 px at SSx, intensity carries the sub-pixel width
            dr.line((float(a), float(b), float(c), float(d)), fill=int(round(255 * ww / 2.0)), width=1)
            continue
        lw = max(1, int(round(ww)))
        dr.line((float(a), float(b), float(c), float(d)), fill=255, width=lw)
        if lw >= 3:
            rr = lw / 2.0 - 0.5
            dr.ellipse((c - rr, d - rr, c + rr, d + rr), fill=255)
    a = np.asarray(im, np.float32) / 255.0
    return a.reshape(H, SS, W, SS).mean(axis=(1, 3))


def value_noise(rng, scale: int, sigma: float) -> np.ndarray:
    """Low-frequency seeded field 0..1 at 1920x1080."""
    gh, gw = H // scale + 2, W // scale + 2
    n = gaussian_filter(rng.normal(0, 1, (gh, gw)), sigma)
    big = np.asarray(Image.fromarray(n.astype(np.float32)).resize((W, H), Image.BICUBIC))
    big = (big - big.min()) / max(1e-6, big.max() - big.min())
    return big.astype(np.float32)


def upsample2(a: np.ndarray) -> np.ndarray:
    return np.repeat(np.repeat(a, TG, axis=0), TG, axis=1)


# --- renderer ---------------------------------------------------------------------------------------------------
class Renderer:
    def __init__(self, sim: Sim, cols, T: np.ndarray, seed: int):
        self.T = T
        x0, y0, x1, y1, w, cls, step = cols
        self.seg_frame = frame_of_step(step, T)
        self.cols = (x0, y0, x1, y1, w, cls)
        # enclosed pockets the growth never reached ice over right after their surroundings: propagate the latest
        # neighbouring freeze step inward (7x7 max, 4 passes = pockets up to ~24 px across)
        fill = np.where(sim.terr == 0, -1, sim.terr_step).astype(np.int32)
        for _ in range(4):
            m = maximum_filter(fill, 7)
            fill = np.where(fill < 0, m, fill)
        fill = np.where(fill < 0, int(sim.s_end), fill)
        self.terr_frame = frame_of_step(fill, T)
        self.terr_tree = sim.tree_of[sim.terr]
        self.tree_haze = np.asarray(sim.tree_haze, np.float32)
        r = np.random.default_rng(seed + 100)
        self.patch = 0.80 + 0.20 * value_noise(r, 32, 1.6)                       # uneven ice thickness
        g = r.normal(0, 1, (H, W)).astype(np.float32)
        g = gaussian_filter(g, 1.2); self.grain = (g / g.std()).astype(np.float32)   # static micro-crystals
        self.dust = (r.random((H, W), dtype=np.float32) < 0.002).astype(np.float32)  # static bright specks in the ice
        self.u_sp = r.random((H, W), dtype=np.float32)                                # sparkle candidates
        self.phase = (r.random((H, W), dtype=np.float32) * 2 * np.pi).astype(np.float32)
        self.rate = (0.25 + 1.2 * r.random((H, W), dtype=np.float32)).astype(np.float32)
        steady = r.random((H, W), dtype=np.float32) < 0.3
        self.rate = np.where(steady, 0.04, self.rate).astype(np.float32)
        self.cry = np.zeros((H, W), np.float32)
        self.birth = np.zeros((H, W), np.int32)
        lx, ly, lz = -0.55, -0.60, 0.60
        nl = math.sqrt(lx * lx + ly * ly + lz * lz)
        self.light = (lx / nl, ly / nl, lz / nl)
        self.flat_ndl = self.light[2]

    def frame(self, n: int):
        x0, y0, x1, y1, w, cls = self.cols
        m = self.seg_frame == n
        if m.any():
            new = draw_segments(x0[m], y0[m], x1[m], y1[m], w[m])
            self.cry = np.maximum(self.cry, new)
            self.birth = np.where((new > 0.02) & (self.birth == 0), n, self.birth)
        born = self.birth > 0
        agec = np.where(born, n - self.birth, -1).astype(np.float32)
        fade = np.clip((agec + 1.0) / 2.0, 0, 1)                                  # 0.5 on the birth frame
        thick = 0.6 + 0.4 * (1.0 - np.exp(-np.maximum(agec, 0) / 5.0))
        cry = np.clip(self.cry * fade * thick, 0, 1).astype(np.float32)
        # the ice: (a) the feather BODY = the branch density at three scales (dense feathers go white and soft),
        # (b) the territory age (ice thickens over ~7 frames behind the front), per-tree density, a patch field,
        # (c) static micro-crystal grain and bright specks
        b1 = gaussian_filter(cry, 1.5); b2 = gaussian_filter(cry, 4.0); b3 = gaussian_filter(cry, 10.0)
        body = np.clip(1.3 * b1 + 1.4 * b2 + 1.6 * b3, 0, 1)
        age_t = (n - self.terr_frame).astype(np.float32)
        hz = np.where(self.terr_frame <= n, 1.0 - np.exp(-(age_t + 1.0) / 4.0), 0.0) * self.tree_haze[self.terr_tree]
        hz = maximum_filter(hz.astype(np.float32), 3)                      # the 1-cell seams between feathers close
        hz = gaussian_filter(upsample2(hz), 2.5)
        ice = np.clip(hz * (0.60 + 0.40 * body) * self.patch, 0, 1)
        ice = np.clip(ice * (1.0 + 0.12 * self.grain) + 0.35 * self.dust * ice, 0, 1).astype(np.float32)
        # relief: emboss of the height field (spines + ice body), lit from the upper left (the studio key)
        h = gaussian_filter(cry, 1.0) + 0.8 * gaussian_filter(ice, 2.0)
        gy, gx = np.gradient(h)
        k = 4.0
        nz = 1.0 / np.sqrt(1.0 + k * k * (gx * gx + gy * gy))
        ndl = (-k * gx * self.light[0] - k * gy * self.light[1] + self.light[2]) * nz
        lit = np.clip(0.5 + (ndl - self.flat_ndl) * 3.0, 0, 1)
        relief = 0.60 + 0.40 * lit                                                # ice body: flat 0.80, lit 1.0, shadow 0.60
        relief_c = 0.78 + 0.22 * lit                                              # spines stay bright on both sides
        # light (premultiplied): crystals PEAK x relief, #DCEBFF -> white in the cores; ice <= 0.80 in #BFD7F5 -> #DCEBFF
        col_cry = ICE[None, None, :] * (1 - cry[..., None]) + WHITE[None, None, :] * cry[..., None]
        col_ice = ICE2[None, None, :] * (1 - ice[..., None]) + ICE[None, None, :] * ice[..., None]
        L = (PEAK * cry * relief_c)[..., None] * col_cry
        L = L + (1.0 * ice * relief * (1 - cry))[..., None] * col_ice
        lum = L.mean(-1)
        bloom = 0.50 * gaussian_filter(np.clip(lum - 0.30, 0, 1), 10.0)
        L = np.clip(L + bloom[..., None] * ICE[None, None, :], 0, PEAK + 0.02)
        # sparkles: seeded candidate pixels on the crystals (and a few in the ice), each with its phase and rate
        cand = ((cry > 0.45) & (self.u_sp < 0.006) & (agec >= 1)) | ((ice > 0.5) & (self.u_sp < 0.0006))
        tw = np.clip(np.sin(self.phase + self.rate * n), 0, 1) ** 8
        pts = np.where(cand, tw, 0.0).astype(np.float32)
        cross = np.zeros_like(pts)
        cross[1:, :] += pts[:-1, :]; cross[:-1, :] += pts[1:, :]; cross[:, 1:] += pts[:, :-1]; cross[:, :-1] += pts[:, 1:]
        glow = gaussian_filter(pts, 1.5) * 2.0
        spark = np.clip(pts + 0.45 * cross + 0.5 * glow, 0, 1)
        L = np.clip(L + spark[..., None], 0, 1)
        # alpha = coverage: union of the crystals and the ice (fully thick ice = 0.85)
        cov = 1.0 - (1.0 - cry) * (1.0 - 0.90 * ice)
        alpha = np.clip(np.maximum(cov, L.max(-1)), 0, 1).astype(np.float32)
        rgb = np.clip(L / np.maximum(alpha, 1e-4)[..., None], 0, 1)
        out = np.empty((H, W, 4), np.uint8)
        out[..., :3] = np.round(rgb * 255).astype(np.uint8)
        out[..., 3] = np.round(alpha * 255).astype(np.uint8)
        return out, L.astype(np.float32), alpha


# --- QC helpers -------------------------------------------------------------------------------------------------
def screen_over(plate: np.ndarray, fr: np.ndarray) -> np.ndarray:
    """What the browser shows for mix-blend-mode: screen on an RGBA element: C = B + L (1 - B), L = rgb * alpha."""
    L = fr[..., :3].astype(np.float32) / 255.0 * (fr[..., 3:4].astype(np.float32) / 255.0)
    return np.clip(plate + L * (1 - plate), 0, 1)


def to_u8(a):
    return np.clip(np.round(a * 255), 0, 255).astype(np.uint8)


def bez(t, x1=0.6, y1=0.0, x2=0.2, y2=1.0):
    t = min(max(t, 0.0), 1.0)
    if t <= 0 or t >= 1:
        return t

    def cub(a, b, u):
        return 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u * u * b + u ** 3
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if cub(x1, x2, mid) < t:
            lo = mid
        else:
            hi = mid
    return cub(y1, y2, (lo + hi) / 2)


def thaw_mask(f, cx=960.0, cy=540.0, edge=40.0):
    if f < 803:
        return np.zeros((H, W), np.float32)
    rad = 520.0 * bez((f - 803) / 18.0)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.hypot(xx - cx + 0.5, yy - cy + 0.5)
    return np.clip((rad + edge / 2 - d) / edge, 0.0, 1.0)


def soft_clip(rgb, mask_outside):
    hi = rgb > 0.92
    clipped = 0.92 + 0.08 * np.tanh((rgb - 0.92) / 0.08)
    return np.where(hi & (mask_outside[..., None] > 0.5), clipped, rgb)


def phone_frost(rgb, alpha, ms, frost_rgba, f, rail_gain=1.0, centre_gain=0.15, edge_px=100.0, glass_gamma=1.0):
    """Proposed post_layers.py step 2 (take, f708-f821).
        fl    = frost_rgb * frost_alpha                   the field's light (premultiplied; crystals 0.80, ice ~0.55)
        glass = fill_holes(matte_screen > 0.5)            the display incl. the Dynamic Island hole (0/1)
        d     = EDT(glass)                                px from the glass edge, inside the glass
        g     = (1 - glass) * rail_gain                   rails, buttons, bezel: the full field
              + glass * (centre_gain + (1 - centre_gain) * exp(-d / edge_px))      dense at the glass edge, thin centre
        fl'   = fl ** (1 + glass_gamma * glass)           contrast on the glass: the ice haze drops, the crystals stay
        w     = alpha * g * (1 - thaw(f))                 thaw unchanged (radial from (960, 540), 520 px, f803-f821)
        rgb   = screen(rgb, fl' * w)                      alpha unchanged
    Defaults: rail_gain 1.0, centre_gain 0.15, edge_px 100, glass_gamma 1.0.
    """
    fl = frost_rgba[..., :3].astype(np.float32) / 255.0 * (frost_rgba[..., 3:4].astype(np.float32) / 255.0)
    glass = binary_fill_holes(ms > 0.5).astype(np.float32)
    d = distance_transform_edt(glass > 0.5).astype(np.float32)
    g = (1 - glass) * rail_gain + glass * (centre_gain + (1 - centre_gain) * np.exp(-d / edge_px))
    flp = np.power(np.clip(fl, 0, 1), (1.0 + glass_gamma * glass)[..., None])
    w = alpha * g * (1 - thaw_mask(f))
    return 1 - (1 - rgb) * (1 - flp * w[..., None])


def qc(out: Path, frames_L: dict, phone_frames):
    plate = np.asarray(Image.open(ROOT / "assets/plates/macro_last.png").convert("RGB"), np.float32) / 255.0
    picks = [10, 20, 30, 40, 50, 60]
    tw, th = 960, 540
    sheet = Image.new("RGB", (3 * tw, 2 * (th + 24)), (20, 22, 26))
    dr = ImageDraw.Draw(sheet)
    for i, n in enumerate(picks):
        fr = np.asarray(Image.open(out / f"frost_{n:04d}.png").convert("RGBA"))
        comp = Image.fromarray(to_u8(screen_over(plate, fr))).resize((tw, th), Image.LANCZOS)
        r, c = divmod(i, 3)
        sheet.paste(comp, (c * tw, r * (th + 24)))
        dr.text((c * tw + 6, r * (th + 24) + th + 4), f"frame {n}  f{F0 + n - 1}", fill=(230, 230, 230))
    sheet.save(out / "contact.png")
    fr = np.asarray(Image.open(out / "frost_0045.png").convert("RGBA"))
    x, y, cw, ch = 300, 150, 480, 270
    comp = to_u8(screen_over(plate, fr))[y:y + ch, x:x + cw]
    Image.fromarray(comp).resize((cw * 4, ch * 4), Image.NEAREST).save(out / "crop45_x4.png")
    blk = to_u8(screen_over(np.zeros_like(plate), fr))[y:y + ch, x:x + cw]
    Image.fromarray(blk).resize((cw * 4, ch * 4), Image.NEAREST).save(out / "crop45_x4_black.png")
    # the phone test
    full = np.asarray(Image.open(out / "frost_full.png").convert("RGBA"))
    for f in phone_frames:
        bp = ROOT / "renders/3d/take/beauty" / f"{f:04d}.png"
        mp = ROOT / "renders/3d/take/matte_screen" / f"{f:04d}.png"
        if not bp.exists() or not mp.exists():
            print(f"  phone test: {bp} / {mp} missing, skipped", file=sys.stderr)
            continue
        rgba = np.asarray(Image.open(bp).convert("RGBA"), np.float32) / 255.0
        rgb, alpha = rgba[..., :3], rgba[..., 3]
        ms = np.asarray(Image.open(mp).convert("RGB"), np.float32)[..., 0] / 255.0
        rgb = soft_clip(rgb, 1.0 - ms)
        rgb = phone_frost(rgb, alpha, ms, full, f)
        over_black = np.clip(rgb * alpha[..., None], 0, 1)
        Image.fromarray(to_u8(over_black)).save(out / f"phone_{f:04d}.png")
        ys, xs = np.nonzero(alpha > 0.5)
        x0, x1, y0, y1 = max(0, xs.min() - 30), min(W, xs.max() + 30), max(0, ys.min() - 30), min(H, ys.max() + 30)
        crop = Image.fromarray(to_u8(over_black)[y0:y1, x0:x1])
        crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS).save(out / f"phone_{f:04d}_crop.png")
    print(f"  QC written to {out}", file=sys.stderr)


# --- main -------------------------------------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(SCRATCH))
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--front-frame", type=int, default=32, help="frame index (1 = f648) on which the front reaches the label window (half of it iced)")
    ap.add_argument("--close-frame", type=int, default=37, help="frame index on which the label window is iced over (99 %)")
    ap.add_argument("--qc", action="store_true")
    ap.add_argument("--qc-only", action="store_true", help="only rebuild the QC images from frames already in --out")
    ap.add_argument("--phone-frames", default="738,760")
    ap.add_argument("--max-steps", type=int, default=900)
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    if args.qc_only:
        qc(out, None, [int(v) for v in args.phone_frames.split(",") if v])
        return

    print(f"growth sim (seed {args.seed})", file=sys.stderr)
    sim = Sim(args.seed)
    cols = sim.run(args.max_steps)
    cx, cy, hw, hh = CENTRE
    iced = minimum_filter(sim.terr_step, 3)                     # a cell counts as iced once a neighbour is (the haze blur)
    win = iced[(cy - hh) // TG:(cy + hh) // TG, (cx - hw) // TG:(cx + hw) // TG]
    s_end = float(sim.s_end)
    s_front = float(np.percentile(win, 50)) if (win < 10 ** 6).mean() >= 0.5 else s_end
    s_close = float(np.percentile(win, 99)) if (win < 10 ** 6).mean() >= 0.99 else s_end
    T = time_curve(s_front, s_close, s_end, args.front_frame, args.close_frame)
    print(f"  label window: front (50 %) on sim step {s_front:.0f} -> frame {args.front_frame} (f{F0 + args.front_frame - 1}); "
          f"iced (99 %) on step {s_close:.0f} -> frame {args.close_frame} (f{F0 + args.close_frame - 1}); "
          f"sim end step {s_end:.0f} -> frame {args.close_frame + 9}", file=sys.stderr)

    ren = Renderer(sim, cols, T, args.seed)
    dens, prev_sum, prev = [], 0.0, None
    yy, xx = np.mgrid[0:H, 0:W]
    for n in range(1, N_FRAMES + 1):
        fr, L, a = ren.frame(n)
        Image.fromarray(fr, "RGBA").save(out / f"frost_{n:04d}.png", compress_level=6)
        s = float(a.sum())
        new = np.clip(a - (prev if prev is not None else 0.0), 0, None)
        wsum = float(new.sum())
        c = a[cy - hh:cy + hh, cx - hw:cx + hw]
        cl = L[cy - hh:cy + hh, cx - hw:cx + hw].mean(-1)
        dens.append({
            "frame": n, "f": F0 + n - 1, "T": round(float(T[n]), 1),
            "new_px": round(s - prev_sum, 1),
            "centroid": [round(float((new * xx).sum() / wsum), 1), round(float((new * yy).sum() / wsum), 1)] if wsum > 1 else None,
            "coverage": round(s / (W * H), 4),
            "centre_cov": round(float((c > 0.5).mean()), 4),
            "centre_alpha": round(float(c.mean()), 4),
            "centre_light": round(float(cl.mean()), 4),
            "peak_light": round(float(np.percentile(L.max(-1), 99.9)), 3),
        })
        prev_sum, prev = s, a
        print(f"  frame {n:2d} f{F0 + n - 1}  new {dens[-1]['new_px']:9.0f}  cov {dens[-1]['coverage']:.3f}  "
              f"centre cov/alpha/light {dens[-1]['centre_cov']:.3f}/{dens[-1]['centre_alpha']:.3f}/{dens[-1]['centre_light']:.3f}  "
              f"peak {dens[-1]['peak_light']:.2f}  {time.time() - t0:5.0f} s", file=sys.stderr)
    Image.fromarray(fr, "RGBA").save(out / "frost_full.png", compress_level=6)
    meta = {"note": "S07 frost v2 (tools/make_frost_v2.py, feather dendrites). frame n = film frame f0 + n - 1; new_px = "
                    "alpha-sum delta at 1080p (pixel units) -> SFX crackle density; centroid = stage px of the new frost; "
                    "centre_cov = fraction of the label window (960,540 +/- 190x105) with alpha > 0.5; centre_light = mean "
                    "premultiplied light over the window (what the screen blend adds); peak_light = 99.9th pct of the light",
            "f0": F0, "fps": 30, "frames": N_FRAMES, "seed": args.seed, "sim_steps": int(s_end), "s_front": s_front,
            "s_close": s_close, "front_frame_target": args.front_frame, "close_frame_target": args.close_frame,
            "close_frame": next((d["f"] for d in dens if d["centre_alpha"] >= 0.5), None),
            "full_frame": next((d["f"] for d in dens if d["coverage"] >= 0.60), None),
            "density": dens}
    (out / "frost_density.json").write_text(json.dumps(meta, indent=1))
    print(f"centre iced (mean alpha >= 0.5 over the label window) on f{meta['close_frame']} (target f686 +/- 2); "
          f"frame coverage (mean alpha) >= 0.60 on f{meta['full_frame']}; {time.time() - t0:.0f} s", file=sys.stderr)
    if args.qc:
        qc(out, None, [int(v) for v in args.phone_frames.split(",") if v])
    print(f"done in {time.time() - t0:.0f} s", file=sys.stderr)


if __name__ == "__main__":
    main()
