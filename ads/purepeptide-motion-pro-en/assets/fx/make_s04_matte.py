# S04 soft luma mattes of the sealed cap (cap.mp4) for the two horizontal light passes (SHOTS §S04: "two quick horizontal light
# passes (6 f each) over the sealed cap on f336 = VO.w('L04',0) and f357 = VO.w('L04',2)"). Same family as make_s03_matte.py, but
# ONE MATTE PER PLATE FRAME the passes light: the plate's own descent grows the cap 2–3 px per frame, so a single matte cut at the
# pass centre leaked 6–8 px of band onto the black beyond the rim on the entry frame (a lit sliver on the cap's left rim, measured
# matte alpha 0.82 beyond the silhouette at f355) and sat inside the rim on the exit frame.
#
# Which plate file a composition frame shows (MEASURED on a 1 s scratch render of cap.mp4 at data-start 0, HyperFrames 0.8.73,
# chrome-headless-shell 152, beginFrame capture; every rendered frame matched to its source frame by pixel diff): for timeline frame
# n after the clip's start (24 fps source in the 30 fps timeline) the render shows source index ceil(0.8·n − 0.6) = file index + 1,
# i.e. the frame with PTS ≥ t − 25 ms. (`hyperframes snapshot` shows one source frame later on 4 of 5 frames — TECH §6's "n + 1".)
# For S04 (n = f − 306): pass A f334 → #23, f335 → #24, f336 → #25, f337/f338 → #26; pass B f355 → #40, f356 → #41, f357/f358 → #42,
# f359 → #43. The band is off on f333 / f339 / f354 / f360 (u = 0 / 1), so eight mattes cover both passes.
#
# matte = env · max(0.9, smoothstep(luma, 12, 120) blurred 3 px), env = silhouette ERODED 3 px then blurred 5 px: the envelope alone
# governs the edge (≈ 0.2 at the true rim, 0 beyond 4 px: the feather sits ON the object, a one-frame mapping error of 2–3 px cannot
# put light on the black), the luma term lifts the interior to 1.0 on the bright crimp (0.9 on the blue cap, whose luma only
# reaches 0.78). Then faded to 0 over the top 48 px and the bottom 90 px of the frame (the crimp and the shoulder touch the bottom
# edge in every frame of this plate) so a band inside the matte can never meet a frame edge with a hard line (QC rule). RGBA PNG:
# RGB white, alpha = matte (CSS mask-image reads the alpha). The plate's black is exactly 0 in the corners (measured).
# Usage: ffmpeg -i assets/plates/ai/cap.mp4 <dir>/%03d.png ; python3 assets/fx/make_s04_matte.py <dir> assets/fx
import sys
import numpy as np
from PIL import Image, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
FRAMES = (23, 24, 25, 26, 40, 41, 42, 43)  # plate files (1-based) the passes light in the render, see above
ERODE_PX, ENV_BLUR, LUM_BLUR = 3, 5, 3


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


for fr in FRAMES:
    rgb = np.array(Image.open(f'{SRC}/{fr:03d}.png').convert('RGB')).astype(float)
    L = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    H, W = L.shape
    sil = np.zeros_like(L)
    for y in range(H):  # per-row span of the cap + crimp + shoulder (the plate is black outside it)
        xs = np.where(L[y, 380:1540] > 14)[0]
        if len(xs) > 20:
            sil[y, 380 + xs.min():380 + xs.max() + 1] = 1
    sil_img = Image.fromarray((sil * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * ERODE_PX + 1))  # erode
    env = np.array(sil_img.filter(ImageFilter.GaussianBlur(ENV_BLUR))).astype(float) / 255
    lum = np.array(Image.fromarray((smooth(L, 12, 120) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(LUM_BLUR))).astype(float) / 255
    m = env * np.maximum(0.9, lum)
    yy = np.arange(H)[:, None].astype(float)
    m *= smooth(yy, 0, 48) * (1 - smooth(yy, 990, 1070))  # never a hard line on the top / bottom frame edge
    out = np.zeros(L.shape + (4,), np.uint8)
    out[..., :3] = 255
    out[..., 3] = (m * 255).round().astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'{OUT}/s04_matte_{fr:02d}.png', optimize=True)
    blue = (rgb[..., 2] - rgb[..., 0] > 60) & (rgb[..., 2] > 120)  # the blue cap
    bc, br = np.where(blue.any(axis=0))[0], np.where(blue.any(axis=1))[0]
    cols = np.where(sil.max(axis=0) > 0.5)[0]
    rows = np.where(sil.max(axis=1) > 0.5)[0]
    beyond = m * (sil == 0)  # matte alpha on the plate's black
    print(f'#{fr:02d}: object x {cols.min()}–{cols.max()}  y {rows.min()}–{rows.max()}  cap x {bc.min()}–{bc.max()} y {br.min()}–{br.max()}  '
          f'matte>0.5 px {int((m > 0.5).sum())}  max alpha beyond the silhouette {beyond.max():.2f}')
