#!/usr/bin/env python3
"""Film grade for every raster source (Blender plates, catalog vials, stills) so the whole film shares one look.
The same curve is implemented in GLSL for the three.js shots (js/stage3d.js, GRADE_GLSL) — keep them in sync.

  grade(x): black crush (toe) -> filmic S-curve on mids -> soft shoulder -> specular-only bloom.
usage: tools/grade.py all | video <in> <out> | still <in> <out> [crop x0,y0,x1,y1] [--w 2112]
"""
import os, subprocess, sys
import numpy as np
import cv2

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BL = os.path.abspath(os.path.join(ROOT, '..', 'purepeptide-blender', 'renders'))
OUT = os.path.join(ROOT, 'assets', 'plates')

BLACK = 0.018   # toe: everything under this goes to pure black (deep blacks)
S_AMT = 0.30    # mid-tone S-curve amount
KNEE = 0.80     # shoulder start
BLOOM_T = 0.86  # bloom threshold (speculars only)
BLOOM_A = (0.10, 0.07)  # small + wide bloom amounts
COOL = np.array([0.985, 1.0, 1.02], np.float32)  # very slight cool neutral


def curve(x):
    x = np.clip((x - BLACK) / (1 - BLACK), 0, 1)
    s = x * x * (3 - 2 * x)
    x = x + S_AMT * (s - x)
    k = KNEE
    hi = x > k
    x[hi] = k + (1 - k) * np.tanh((x[hi] - k) / (1 - k)) / np.tanh(1.0)
    return x


def grade(img):  # float32 RGB 0..1, returns float32
    h, w = img.shape[:2]
    y = curve(img.copy()) * COOL
    lum = y @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    hp = np.clip((lum - BLOOM_T) / (1 - BLOOM_T), 0, 1)[..., None] * y
    sc = w / 1920.0
    b1 = cv2.GaussianBlur(hp, (0, 0), 5 * sc)
    b2 = cv2.GaussianBlur(hp, (0, 0), 22 * sc)
    b = BLOOM_A[0] * b1 + BLOOM_A[1] * b2
    y = 1 - (1 - y) * (1 - b)  # screen
    return np.clip(y, 0, 1)


def load(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im.dtype == np.uint16:
        im = (im / 257).astype(np.uint8)
    rgb = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2RGB).astype(np.float32) / 255
    return rgb


def save(path, rgb):
    bgr = cv2.cvtColor((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8), cv2.COLOR_RGB2BGR)
    if path.endswith('.jpg'):
        cv2.imwrite(path, bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
    else:
        cv2.imwrite(path, bgr)


def still(src, dst, crop=None, w=2112):
    """crop = (x0, y0, x1, y1) in source pixels (16:9); output w x w*9/16 (default 2112 = 10 % push headroom)."""
    img = load(src)
    if crop:
        x0, y0, x1, y1 = crop
        img = img[y0:y1, x0:x1]
    h = round(w * 9 / 16)
    img = cv2.resize(img, (w, h), interpolation=cv2.INTER_LANCZOS4 if img.shape[1] < w else cv2.INTER_AREA)
    save(dst, grade(img))
    print('still', os.path.relpath(dst, ROOT))


def video(src, dst, fps=30):
    probe = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).decode().strip().split(',')
    w, h = int(probe[0]), int(probe[1])
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-g', '15', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
    n = 0
    while True:
        buf = dec.stdout.read(w * h * 3)
        if len(buf) < w * h * 3:
            break
        img = np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(np.float32) / 255
        enc.stdin.write((grade(img) * 255 + 0.5).astype(np.uint8).tobytes())
        n += 1
    enc.stdin.close()
    enc.wait()
    print('video', os.path.relpath(dst, ROOT), n, 'frames')


def frame_of(src, n, dst_png):
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', f'select=eq(n\\,{n})', '-frames:v', '1', dst_png])


def vials():
    """catalog renders -> black-world versions: cylinder shading (key from the left), graded, alpha kept."""
    vd = os.path.join(ROOT, 'assets', 'vials')
    od = os.path.join(OUT, 'vials')
    os.makedirs(od, exist_ok=True)
    for f in sorted(os.listdir(vd)):
        if not f.endswith('.png'):
            continue
        from PIL import Image
        im = np.asarray(Image.open(os.path.join(vd, f)).convert('RGBA')).astype(np.float32) / 255
        rgb, a = im[..., :3], im[..., 3:]
        h, w = a.shape[:2]
        cols = np.where(a[..., 0].max(0) > 0.5)[0]
        x0, x1 = cols.min(), cols.max()
        u = np.clip((np.arange(w) - x0) / max(1, x1 - x0), 0, 1)  # 0..1 across the vial
        # cylinder: key from front-left (peak at u=0.38), dark flanks, thin rim catch on the far right edge
        shade = 0.42 + 0.58 * np.clip(np.cos((u - 0.38) * np.pi * 0.95), 0, 1) ** 0.8
        shade += 0.35 * np.exp(-((u - 0.965) / 0.018) ** 2)
        v = np.arange(h) / h
        vert = 0.86 + 0.14 * np.clip(1 - v * 1.1, 0, 1)  # top-lit
        m = shade[None, :, None] * vert[:, None, None]
        out = grade(np.clip(rgb * m * 0.92, 0, 1))
        res = np.concatenate([out, a], -1)
        Image.fromarray((res * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(od, f), optimize=True)
        print('vial', f)


def all_():
    os.makedirs(OUT, exist_ok=True)
    F = os.path.join(ROOT, 'assets', 'footage')
    video(os.path.join(F, 'hero.mp4'), os.path.join(OUT, 'hero_g.mp4'))
    video(os.path.join(F, 'turntable.mp4'), os.path.join(OUT, 'turntable_g.mp4'))
    tmp = '/tmp/claude-0/film/frames'
    os.makedirs(tmp, exist_ok=True)
    frame_of(os.path.join(F, 'hero.mp4'), 89, tmp + '/hero_89.png')
    frame_of(os.path.join(F, 'turntable.mp4'), 60, tmp + '/tt_60.png')
    frame_of(os.path.join(F, 'turntable.mp4'), 119, tmp + '/tt_119.png')
    still(tmp + '/hero_89.png', os.path.join(OUT, 'hero_last.jpg'))
    still(tmp + '/tt_60.png', os.path.join(OUT, 'tt_60.jpg'))
    still(tmp + '/tt_119.png', os.path.join(OUT, 'tt_119.jpg'))
    still(BL + '/_tests/macro_sweep/0045.png', os.path.join(OUT, 'macro_a.jpg'))
    still(BL + '/_tests2/macro_sweep/0023.png', os.path.join(OUT, 'macro_b.jpg'))
    still(BL + '/_tests/cap_top/0040.png', os.path.join(OUT, 'cap_a.jpg'))
    still(BL + '/_tests2/cap_top/0038.png', os.path.join(OUT, 'cap_b.jpg'))
    still(BL + '/cap_top/0001.png', os.path.join(OUT, 'cap_side.jpg'))
    vials()


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if cmd == 'all':
        all_()
    elif cmd == 'video':
        video(sys.argv[2], sys.argv[3])
    elif cmd == 'vials':
        vials()
    elif cmd == 'still':
        crop = tuple(int(v) for v in sys.argv[4].split(',')) if len(sys.argv) > 4 and ',' in sys.argv[4] else None
        still(sys.argv[2], sys.argv[3], crop)
