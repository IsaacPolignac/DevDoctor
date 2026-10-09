#!/usr/bin/env python3
"""tools/post_layers.py <id> [--range a-b] [--no-phone-frost] [--shadow fake|none] [--force]
Per-frame numpy post of a rendered 3D layer (SHOTS Appendix 2.1), deterministic:
  renders/3d/<id>/{beauty,matte_screen,matte_cards,shadow}/####.png → renders/3d/<id>/final/####.png (straight alpha)
  1. soft-clip above 92 % (sRGB levels) on RGB outside matte_screen: y > 0.92 → 0.92 + 0.08·tanh((y−0.92)/0.08)
  2. frost (take, f708–f821): rgb = screen(rgb, frost^(1+glass) · w), w = alpha · g · (1 − thaw(f)), g = 1 on the rails,
     0.15 + 0.85·exp(−d/100 px) on the glass (d = distance from the glass edge);
     thaw = radial mask from (960, 540), radius 520·bez((f−803)/18) for f ≥ 803, soft edge 40 px; alpha unchanged
  3. shadow (take, f945–f1044): rgb *= 1 − 0.35·blur4(1 − shadow_rgb)·matte_screen·attach (shadow pass at pct 50 → upscaled);
     attach keeps only the shadow blobs that touch a visible slab (≤ 25 px, gone by 50 px): the off-axis shadow light threw
     detached grey blobs onto the empty page while a slab was still under the glass (f955–f960, f1036–f1039)
  3b. exit glint (take, f1169–f1175): the render had ONE full-white frame of glass (f1172, a strobe). f1172's glass is
     rebuilt from f1171 and f1173 (row by row, span-normalised), then a diagonal sheen sweeps down the glass over 7 frames,
     peaking on f1172 (GLINT_ENV), screen-blended inside matte_screen
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
from scipy.ndimage import binary_fill_holes, distance_transform_edt, label, minimum

RAIL_GAIN, CENTRE_GAIN, EDGE_PX, GLASS_GAMMA = 1.0, 0.15, 100.0, 1.0   # on-phone frost weighting (frost v2)
ATTACH_PX, ATTACH_SOFT = 25.0, 25.0                                    # shadow blobs must touch a slab (step 3)
GLINT = 1172                                                           # exit glint (step 3b)
GLINT_ENV = {1169: 0.20, 1170: 0.45, 1171: 0.75, 1172: 0.95, 1173: 0.75, 1174: 0.45, 1175: 0.20}
GLINT_Y0, GLINT_Y1, GLINT_SIGMA, GLINT_TILT = 150.0, 950.0, 70.0, math.tan(math.radians(25))

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


def attach_gate(dark, ms, mc):
    """1 on the shadow blobs that touch a visible slab, 0 on detached ones (and everywhere when no slab is visible)."""
    cards = mc > 0.5
    if not cards.any():
        return np.zeros_like(dark)
    lab, n = label(dark * ms > 0.02)
    if n == 0:
        return np.zeros_like(dark)
    dist = distance_transform_edt(~cards)
    mind = np.asarray(minimum(dist, lab, index=np.arange(1, n + 1)), np.float32)
    keep = np.concatenate([[0.0], np.clip(1.0 - (mind - ATTACH_PX) / ATTACH_SOFT, 0.0, 1.0)]).astype(np.float32)
    return gaussian(keep[lab], 2.0)


def glass_cover(ms, grow=3):
    """the cover glass: matte_screen with the Dynamic Island hole filled, grown by `grow` px over the antialiased rim."""
    g = binary_fill_holes(ms > 0.5)
    if grow:
        g = distance_transform_edt(~g) <= grow
    return g


def _glass_spans(g):
    rows = {}
    for y in np.where(g.any(1))[0]:
        xs = np.where(g[y])[0]
        rows[int(y)] = (int(xs[0]), int(xs[-1]))
    return rows


def rebuild_glint_glass(d, f, rgb, ms):
    """f1172's glass rebuilt from f1171 and f1173: each row's glass span (island filled, rim included) is resampled onto
    this frame's span and averaged, so the island and the rim land where they belong."""
    out = rgb.copy()
    srcs = []
    for g in (f - 1, f + 1):
        b = read(os.path.join(d, 'beauty', '%04d.png' % g), 'RGBA')[..., :3]
        m = read(os.path.join(d, 'matte_screen', '%04d.png' % g), 'RGB')[..., 0]
        srcs.append((b, _glass_spans(glass_cover(m))))
    cover = glass_cover(ms)
    for y, (x0, x1) in _glass_spans(cover).items():
        u = (np.arange(x0, x1 + 1) - x0) / max(1, x1 - x0)
        acc, k = 0.0, 0
        for b, spans in srcs:
            if y in spans:
                s0, s1 = spans[y]
                xs = np.clip(np.round(s0 + u * (s1 - s0)).astype(int), 0, b.shape[1] - 1)
                acc = acc + b[y, xs]
                k += 1
        if k:
            out[y, x0:x1 + 1] = acc / k
    for _ in range(3):                      # vertical smoothing: the per-row spans differ by ±1 px → torn rim
        out = _box(out, 1, 0)
    w = gaussian(cover.astype(np.float32), 0.7)[..., None]
    return out * w + rgb * (1 - w)


def glint_sheen(f, rgb, ms, alpha):
    yy, xx = np.mgrid[0:rgb.shape[0], 0:rgb.shape[1]].astype(np.float32)
    xs = np.where(ms > 0.5)[1]
    xc = xs.mean() if len(xs) else rgb.shape[1] / 2
    c = GLINT_Y0 + (f - 1169) * (GLINT_Y1 - GLINT_Y0) / 6.0
    p = yy + GLINT_TILT * (xx - xc)
    cover = gaussian(glass_cover(ms, 0).astype(np.float32), 0.7)
    band = GLINT_ENV[f] * np.exp(-0.5 * ((p - c) / GLINT_SIGMA) ** 2) * cover * alpha
    return 1 - (1 - rgb) * (1 - band[..., None])


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
            # frost v2 (tools/make_frost_v2.py): dense on the rails and the glass edges, thin toward the screen centre;
            # on the glass the haze is squashed (frost^2) so the crystals stay legible instead of a grey veil.
            glass = binary_fill_holes(ms > 0.5).astype(np.float32)       # display incl. the Dynamic Island hole
            dist = distance_transform_edt(glass > 0.5).astype(np.float32)  # px from the glass edge, inside the glass
            g = (1 - glass) * RAIL_GAIN + glass * (CENTRE_GAIN + (1 - CENTRE_GAIN) * np.exp(-dist / EDGE_PX))
            w = alpha * g * (1 - thaw_mask(f, W, H)) * frost_gain
            fl = np.power(frost, (1.0 + GLASS_GAMMA * glass)[..., None]) * w[..., None]
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
                mc_path = os.path.join(d, 'matte_cards', '%04d.png' % f)
                mc = read(mc_path, 'RGB')[..., 0] if os.path.exists(mc_path) else np.zeros_like(ms)
                dark = dark * attach_gate(dark, ms, mc)
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
        # 3b. exit glint (take f1169–f1175)
        if shot == 'take' and f in GLINT_ENV:
            if f == GLINT:
                rgb = rebuild_glint_glass(d, f, rgb, ms)
            rgb = glint_sheen(f, rgb, ms, alpha)
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
