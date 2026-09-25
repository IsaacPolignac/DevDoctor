"""Generate the wrap-around label texture (4096 px wide) with PIL.
Label physical size: 70 mm wrap x 24 mm tall -> 4096 x 1404 px.
Front centre of the vial = u 0.5.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, random
HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, '..', 'assets')
W, H = 4096, 1404
PX_PER_MM = W / 70.0
FONT_B = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
FONT_R = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
C1, C2, C3 = (0x12, 0x3A, 0x78), (0x2A, 0x9A, 0xC2), (0x16, 0xA4, 0x8F)
PAPER = (246, 247, 246)

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def grad(t):
    return lerp(C1, C2, t / .55) if t < .55 else lerp(C2, C3, (t - .55) / .45)

def grad_band(w, h):
    im = Image.new('RGB', (w, h))
    px = im.load()
    for x in range(w):
        c = grad(x / (w - 1))
        for y in range(h):
            px[x, y] = c
    return im

def tracked_text(draw_img, text, font, cx, cy, tracking, fill):
    d = ImageDraw.Draw(draw_img)
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        d.text((x, cy), ch, font=font, fill=fill, anchor='lm')
        x += w + tracking
    return total

def main():
    img = Image.new('RGB', (W, H), PAPER)
    # very faint paper fibre noise
    rnd = random.Random(7)
    noise = Image.effect_noise((W // 4, H // 4), 18).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))
    img = Image.blend(img, Image.merge('RGB', [noise.point(lambda v: 238 + v * 0.06)] * 3), 0.25)
    cx = W // 2
    mm = PX_PER_MM
    # top + bottom brand-gradient bands (full wrap)
    band_h = int(0.55 * mm)
    for y in (int(1.6 * mm), H - int(1.6 * mm) - band_h):
        img.paste(grad_band(W, band_h), (0, y))
    # hairlines next to bands
    d = ImageDraw.Draw(img)
    for y in (int(1.6 * mm) + band_h + int(0.45 * mm), H - int(1.6 * mm) - band_h - int(0.45 * mm)):
        d.rectangle([0, y, W, y + max(2, int(0.08 * mm))], fill=lerp(C1, PAPER, 0.55))
    # symbol
    sym = Image.open(os.path.join(A, 'brand-symbol.png')).convert('RGBA')
    sh = int(6.6 * mm)
    sym = sym.resize((int(sym.width * sh / sym.height), sh), Image.LANCZOS)
    sy = int(4.6 * mm)
    img.paste(sym, (cx - sym.width // 2, sy), sym)
    # wordmark
    wm = Image.open(os.path.join(A, 'brand-wordmark.png')).convert('RGBA')
    ww = int(13.2 * mm)
    wm = wm.resize((ww, int(wm.height * ww / wm.width)), Image.LANCZOS)
    wy = sy + sh + int(1.5 * mm)
    img.paste(wm, (cx - ww // 2, wy), wm)
    # thin gradient rule under wordmark
    ry = wy + wm.height + int(1.1 * mm)
    img.paste(grad_band(ww, max(3, int(0.12 * mm))), (cx - ww // 2, ry))
    # tagline
    f_tag = ImageFont.truetype(FONT_B, int(0.95 * mm))
    tracked_text(img, 'SCIENCE. PURITY. POTENTIAL.', f_tag, cx, ry + int(1.55 * mm), 0.12 * mm, C1)
    # research use only (bottom)
    f_ruo = ImageFont.truetype(FONT_B, int(0.82 * mm))
    tracked_text(img, 'RESEARCH USE ONLY', f_ruo, cx, H - int(4.25 * mm), 0.22 * mm, lerp(C1, C2, 0.35))
    # side panels (seen when rotating): small repeated caps + gradient ticks
    f_side = ImageFont.truetype(FONT_R, int(0.72 * mm))
    for u in (0.2, 0.8):
        x = int(u * W)
        tracked_text(img, 'RESEARCH USE ONLY', f_side, x, H // 2 - int(1.2 * mm), 0.3 * mm, lerp(C1, PAPER, 0.25))
        tracked_text(img, 'SCIENCE. PURITY. POTENTIAL.', f_side, x, H // 2 + int(1.2 * mm), 0.3 * mm, lerp(C1, PAPER, 0.4))
    img.save(os.path.join(A, 'label.png'), optimize=True)
    print('label', img.size)

if __name__ == '__main__':
    main()
