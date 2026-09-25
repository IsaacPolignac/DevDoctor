#!/usr/bin/env python3
"""Film grade for every raster source (Blender plates, catalog vials, stills) so the whole film shares one look.
The three.js shots are rendered raw (plates3d/) and graded here too, so every source shares one curve.

  grade(x): black crush (toe) -> filmic S-curve on mids -> soft shoulder -> specular-only bloom.
usage: tools/grade.py all | stills | vials | plates3d <png-seq-dir> | video <in> <out> | still <in> <out> [x0,y0,x1,y1]
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
    """Rebuild every graded plate used by the film (the three.js plates need `plates3d <png-seq-dir>` after rendering plates3d/)."""
    os.makedirs(OUT, exist_ok=True)
    video(os.path.join(ROOT, 'assets', 'footage', 'turntable.mp4'), os.path.join(OUT, 'turntable_g.mp4'))
    blender_stills()
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


STILLS = os.path.join(BL, 'stills')
# name -> (source still, crop in 2560x1440 px or None)
STILL_PLATES = {
    'rim_full': ('rim_still', None),
    'cap_full': ('cap_still', None),
    'cap_ribs': ('cap_still', (480, 600, 1973, 1440)),
    'hero_full': ('hero_still', None),
    'label_full': ('label_still', None),
    'label_logo': ('label_still', (720, 150, 2427, 1110)),
    'label_word': ('label_still', (600, 520, 2020, 1319)),
    'macro_full': ('macro_still', None),
    'macro_crimp': ('macro_still', (560, 0, 2053, 840)),
    'macro_shoulder': ('macro_still', (620, 200, 2020, 988)),
}


def blender_stills():
    for name, (src, crop) in STILL_PLATES.items():
        still(os.path.join(STILLS, src + '.png'), os.path.join(OUT, name + '.jpg'), crop)


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'stills':
    blender_stills()


def blue_match(img):
    """three.js cap blue is deeper/more saturated than the Cycles cap: lift value, trim saturation on blue hues only."""
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)  # float: H 0..360, S 0..1, V 0..1
    h, s_, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    w = np.clip(1 - np.abs(h - 226) / 22, 0, 1) * np.clip((s_ - 0.35) / 0.2, 0, 1)
    hsv[..., 1] = s_ * (1 - 0.2 * w)
    hsv[..., 2] = np.clip(v * (1 + 0.32 * w), 0, 1)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)


def plates3d(seqdir):
    """three.js plate PNG sequence (plates3d/ render) -> graded per-shot mp4 plates + graded stills."""
    import re, glob
    segs = re.findall(r'name: "(\w+)", n: (\d+)', open(os.path.join(ROOT, 'plates3d', 'js', 'segments.js')).read())
    frames = sorted(glob.glob(os.path.join(seqdir, '*.png')))
    print(len(frames), 'frames in', seqdir)
    f = 0
    for name, n in segs:
        n = int(n)
        fr = frames[f:f + n]
        f += n
        if name.startswith('s3_'):
            tmp = '/tmp/claude-0/film/frames/' + name + '.png'
            save(tmp, blue_match(load(fr[1])))
            still(tmp, os.path.join(OUT, name + '.jpg'))
            continue
        dst = os.path.join(OUT, name + '.mp4')
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1920x1080', '-r', '30', '-i', '-',
                                '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-g', '15', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
        for p in fr:
            img = blue_match(load(p))
            enc.stdin.write((grade(img) * 255 + 0.5).astype(np.uint8).tobytes())
        enc.stdin.close()
        enc.wait()
        print('plate3d', name, len(fr))


if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[1] == 'plates3d':
    plates3d(sys.argv[2])
