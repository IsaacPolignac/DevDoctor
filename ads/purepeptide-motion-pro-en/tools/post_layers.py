#!/usr/bin/env python3
"""tools/post_layers.py <id> [--range a-b] [--no-phone-frost] [--shadow fake|none] [--force]
Per-frame numpy post of a rendered 3D layer (SHOTS Appendix 2.1), deterministic:
  renders/3d/<id>/{beauty,matte_screen,matte_cards,shadow}/####.png → renders/3d/<id>/final/####.png (straight alpha)
  1. soft-clip above 92 % (sRGB levels) on RGB outside matte_screen: y > 0.92 → 0.92 + 0.08·tanh((y−0.92)/0.08)
  2. frost (take, f708–f821): rgb = screen(rgb, frost_full · w), w = alpha · (1 − 0.5·matte_screen) · (1 − thaw(f)),
     thaw = radial mask from (960, 540), radius 520·bez((f−803)/18) for f ≥ 803, soft edge 40 px; alpha unchanged
  3. shadow (take, f945–f1044): rgb *= 1 − 0.35·blur4(1 − shadow_rgb)·matte_screen (shadow pass at pct 50 → upscaled)
  4. a 1-in-30 contact sheet renders/3d/<id>/contact.png
s01 is opaque (RGB, copied as is), s02 gets the soft-clip only. Frames without the frost / shadow inputs are processed
without them (a warning is printed once).
"""
import argparse
import glob
import json
import math
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RENDERS = os.path.join(ROOT, 'renders', '3d')
FROST_FULL = os.path.join(ROOT, 'assets', 'fx', 'frost', 'frost_full.png')


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


def read(path, mode='RGBA'):
    return np.asarray(Image.open(path).convert(mode), dtype=np.float32) / 255.0


def write(path, arr, mode='RGBA'):
    a = np.clip(np.round(arr * 255.0), 0, 255).astype(np.uint8)
    Image.fromarray(a, mode).save(path, compress_level=4)


def _box(a, r, axis):
    a = np.moveaxis(a, axis, 0)
    pad = np.concatenate([np.repeat(a[:1], r + 1, 0), a, np.repeat(a[-1:], r, 0)], 0)
    c = np.cumsum(pad, 0, dtype=np.float64)
    out = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
    return np.moveaxis(out, 0, axis).astype(np.float32)


def gaussian(arr, sigma):
    r = max(1, int(round((math.sqrt(12 * sigma * sigma / 3 + 1) - 1) / 2)))
    out = arr
    for axis in (0, 1):
        for _ in range(3):
            out = _box(out, r, axis)
    return out


def soft_clip(rgb, mask_outside):
    y = rgb
    hi = y > 0.92
    clipped = 0.92 + 0.08 * np.tanh((y - 0.92) / 0.08)
    return np.where(hi & (mask_outside[..., None] > 0.5), clipped, y)


_THAW = {}


def thaw_mask(f, W=1920, H=1080, cx=960.0, cy=540.0, edge=40.0):
    if f < 803:
        return np.zeros((H, W), np.float32)
    key = f
    if key in _THAW:
        return _THAW[key]
    rad = 520.0 * bez((f - 803) / 18.0)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.hypot(xx - cx + 0.5, yy - cy + 0.5)
    m = np.clip((rad + edge / 2 - d) / edge, 0.0, 1.0)
    _THAW[key] = m
    return m


def process(shot, frames, phone_frost=True, shadow_mode='pass', force=False, frost_gain=1.0):
    d = os.path.join(RENDERS, shot)
    beauty = os.path.join(d, 'beauty')
    final = os.path.join(d, 'final')
    os.makedirs(final, exist_ok=True)
    files = sorted(glob.glob(os.path.join(beauty, '*.png')))
    if frames:
        files = [p for p in files if int(os.path.basename(p)[:4]) in frames]
    frost = None
    warned = set()
    if shot == 'take' and phone_frost:
        if os.path.exists(FROST_FULL):
            fr = read(FROST_FULL)
            if fr.shape[:2] != (1080, 1920):
                fr = np.asarray(Image.fromarray((fr * 255).astype(np.uint8)).resize((1920, 1080), Image.LANCZOS), np.float32) / 255
            frost = fr[..., :3] * fr[..., 3:4]            # frost light (premultiplied)
        else:
            print('WARNING: %s missing → no frost on the phone' % FROST_FULL, flush=True)
    done = []
    for p in files:
        f = int(os.path.basename(p)[:4])
        out = os.path.join(final, '%04d.png' % f)
        if os.path.exists(out) and not force:
            continue
        if shot == 'take' and (f < 708 or f > 1188):
            continue
        im = Image.open(p)
        if shot == 'take' and f < 708:
            continue
        if im.mode == 'RGB' or shot == 'take' and (f > 1188):
            pass
        if im.mode in ('RGB', 'L') or shot == 'take' and f < 0:
            arr = read(p, 'RGB')
            write(out, arr, 'RGB')
            done.append(out)
            continue
        if im.mode != 'RGBA':
            arr = read(p, 'RGB')
            write(out, arr, 'RGB')
            done.append(out)
            continue
        rgba = read(p, 'RGBA')
        rgb, alpha = rgba[..., :3], rgba[..., 3]
        H, W = alpha.shape
        ms_path = os.path.join(d, 'matte_screen', '%04d.png' % f)
        if os.path.exists(ms_path):
            ms = read(ms_path, 'RGB')[..., 0]
        else:
            ms = np.zeros((H, W), np.float32)
            if 'ms' not in warned:
                print('WARNING: matte_screen missing for %s f%d (soft-clip applied everywhere, no shadow)' % (shot, f), flush=True)
                warned.add('ms')
        # 1. soft-clip outside the screen
        rgb = soft_clip(rgb, 1.0 - ms)
        # 2. frost inside the alpha (take f708–f821)
        if shot == 'take' and frost is not None and 708 <= f <= 821:
            w = alpha * (1 - 0.5 * ms) * (1 - thaw_mask(f, W, H)) * frost_gain   # gain 1.0 = SHOTS §2.1 as written
            # NOTE (render QC 2026-10-08): frost_full.png has alpha ≈ 0.96 everywhere, so at gain 1.0 the phone body goes
            # from 0.09 to 0.91 luminance at f738 (a white slab; the slow show f750–f786 is invisible). --frost-gain 0.3–0.5
            # keeps a dark, frosted phone (BRIEF §10.4 fallback); re-run with --range 708-821 --force, then encode_layers.sh take.
            fl = frost * w[..., None]
            rgb = 1 - (1 - rgb) * (1 - fl)
        # 3. shadow inside the screen (take f945–f1044)
        if shot == 'take' and 945 <= f <= 1044 and shadow_mode != 'none':
            sh_path = os.path.join(d, 'shadow', '%04d.png' % f)
            if os.path.exists(sh_path):
                sh = Image.open(sh_path).convert('RGB')
                if sh.size != (W, H):
                    sh = sh.resize((W, H), Image.BILINEAR)
                sh = np.asarray(sh, np.float32)[..., 0] / 255.0
                dark = gaussian(1.0 - sh, 4.0)
                rgb = rgb * (1 - 0.35 * dark * ms)[..., None]
            elif shadow_mode == 'fake':
                mc_path = os.path.join(d, 'matte_cards', '%04d.png' % f)
                if os.path.exists(mc_path):
                    mc = read(mc_path, 'RGB')[..., 0]
                    sh1 = np.roll(np.roll(gaussian(mc, 6.0), 10, 0), 6, 1)
                    sh2 = np.roll(np.roll(gaussian(mc, 18.0), 22, 0), 12, 1)
                    dark = np.clip(0.7 * sh1 + 0.5 * sh2, 0, 1) * (1 - mc)
                    rgb = rgb * (1 - 0.35 * dark * ms)[..., None]
            elif 'sh' not in warned:
                print('WARNING: shadow pass missing for f%d (run take.py --pass shadow, or --shadow fake)' % f, flush=True)
                warned.add('sh')
        write(out, np.concatenate([np.clip(rgb, 0, 1), alpha[..., None]], -1), 'RGBA')
        done.append(out)
    # 4. contact sheet (1 in 30)
    allf = sorted(glob.glob(os.path.join(final, '*.png')))
    picks = allf[::30] if allf else []
    if picks:
        tw, th = 384, 216
        cols = 5
        rows = (len(picks) + cols - 1) // cols
        from PIL import ImageDraw
        sheet = Image.new('RGB', (cols * tw, rows * (th + 18)), (24, 26, 30))
        dr = ImageDraw.Draw(sheet)
        for i, q in enumerate(picks):
            im = Image.open(q).convert('RGBA')
            bgc = Image.new('RGBA', im.size, (0, 0, 0, 255))
            bgc.alpha_composite(im)
            r, c = divmod(i, cols)
            sheet.paste(bgc.convert('RGB').resize((tw, th), Image.LANCZOS), (c * tw, r * (th + 18)))
            dr.text((c * tw + 4, r * (th + 18) + th + 2), os.path.basename(q)[:4], fill=(220, 220, 220))
        sheet.save(os.path.join(d, 'contact.png'))
    print('post_layers %s: %d frames written → %s' % (shot, len(done), final), flush=True)
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('shot')
    ap.add_argument('--range', default='')
    ap.add_argument('--no-phone-frost', action='store_true')
    ap.add_argument('--shadow', default='pass', choices=['pass', 'fake', 'none'])
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--frost-gain', type=float, default=1.0,
                    help='scale of the on-phone frost weight (take f708–f821); 1.0 = SHOTS §2.1, 0.3–0.5 = dark frosted phone')
    a = ap.parse_args()
    frames = None
    if a.range:
        frames = set()
        for part in a.range.split(','):
            if '-' in part:
                x, y = part.split('-')
                frames |= set(range(int(x), int(y) + 1))
            else:
                frames.add(int(part))
    process(a.shot, frames, phone_frost=not a.no_phone_frost, shadow_mode=a.shadow, force=a.force, frost_gain=a.frost_gain)


if __name__ == '__main__':
    main()
