#!/usr/bin/env python3
"""Builds index.html (SCENES §0.1, §0.5, §0.8) from:
  - html/<id>.html  scene markup fragments (one <section class="clip scene" id="<id>"> per scene, window from SCENES §0.9)
  - css/*.css       tokens.css, phone.css first, then the scene sheets in scene order, then any other sheet
  - VIDEOS below    stage-level <video> clips (never nested in a timed section), with the seek-limit asserts
  - js/             vendor GSAP, cues, vo, lib, phone-screen, phone, scenes/<id>.js in order, main.js
Edit those sources, never index.html.   Usage: python3 tools/assemble.py [--out index.html] [--extra-js path ...]
--extra-js appends scripts after the scenes (used by temporary tests; never for the shipped index.html)."""
import argparse
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FPS = 30
DUR = 45.0
SCENES = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11']
# Scene windows in frames [in, out) — SCENES §0.9 (same table as PP.WIN in js/lib.js)
WIN = {'S01': (0, 105), 'S02': (105, 278), 'S03': (270, 426), 'S04': (426, 532), 'S05': (532, 674), 'S06': (674, 750),
       'S07': (750, 849), 'S08': (849, 1030), 'S09': (1030, 1086), 'S10': (1086, 1230), 'S11': (1230, 1350)}
# Stage-level media (SCENES §0.5): id, src, data-start, data-duration, data-media-start, z, seek limit (last media s)
VIDEOS = [
    ('v-typevial', 'assets/plates/typevial.mp4', 3.500, 5.799, 0.0, 10, 5.80),
    ('v-hero', 'assets/plates/ai/hero.mp4', 8.733, 2.466, 0.50, 11, 2.97),
    ('v-turn', 'assets/plates/ai/turn.mp4', 11.200, 3.666, 0.0, 11, 3.67),
    ('v-cold', 'assets/plates/ai/cold.mp4', 14.867, 2.999, 0.0, 12, 3.00),
    ('v-flyin', 'assets/iphone/flyin_land.webm', 22.733, 2.266, 0.0, 30, 68 / 30),
]
PRELOAD = ['assets/iphone/front_shadow.png', 'assets/iphone/front_body.png', 'assets/iphone/front_glass.png',
           'assets/site/clean/screen_blank.png', 'assets/site/clean/home.png', 'assets/site/clean/product.png',
           'assets/site/clean/cart1.png', 'assets/site/clean/cart2.png', 'assets/site/clean/cart3.png',
           'assets/brand/brand-symbol-neon.svg', 'assets/brand/brand-wordmark-light.svg'] + \
          [f'assets/fx/grain{i}.png' for i in range(8)] + \
          [f'assets/vials/{v}.png' for v in ('bpc157-tb500-10', 'cjc-1295-ipa-10', 'ghk-cu-50', 'igf-1-lr3-1', 'selank-10', 'semax-10')]
VENDOR = ['assets/vendor/gsap.min.js', 'assets/vendor/DrawSVGPlugin.min.js', 'assets/vendor/CustomEase.min.js']
FONTS = [  # (family, file, weight[, unicode-range]) — BRIEF §3
    ('DM Sans', 'dm-sans-latin-700-normal', '700'), ('DM Sans', 'dm-sans-latin-800-normal', '800'),
    ('Inter', 'inter-latin-400-normal', '400'), ('Inter', 'inter-latin-500-normal', '500'),
    ('Inter', 'inter-latin-600-normal', '600'), ('Inter', 'inter-latin-700-normal', '700'),
    ('IBM Plex Mono', 'ibm-plex-mono-latin-500-normal', '500'), ('Anton', 'anton-latin-400-normal', '400'),
    ('Archivo', 'archivo-latin-800-normal', '800'), ('Archivo', 'archivo-latin-900-normal', '900'),
    ('Inter Tight', 'inter-tight-latin-300-normal', '300'),
    # ≥ and the narrow no-break space are missing from the latin subsets. U+2212 minus IS in DM Sans and Inter.
    # ✓ (U+2713) is in no font: draw it as SVG (PP.checkIcon).
    ('PP Symbols', 'inter-symbols', '100 900', 'U+202F, U+2264-2265'),
]
LIBJS = ['js/cues.js', 'js/vo.js', 'js/lib.js', 'assets/site/screen/phone-screen.js', 'js/phone.js']


def num(x):
    return ('%.4f' % x).rstrip('0').rstrip('.')


def warn(msg):
    print('WARN', msg, file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='index.html')
    ap.add_argument('--extra-js', nargs='*', default=[])
    a = ap.parse_args()

    # ---- videos + seek-limit asserts
    vids = []
    prev_end = {}
    for vid, src, start, dur, ms, z, lim in VIDEOS:
        last = ms + dur - 1 / FPS  # media time of the clip's last frame
        assert last <= lim + 1e-6, f'{vid}: last frame seeks {last:.3f} s into {src} (limit {lim:.3f} s)'
        assert ms >= 0 and start >= 0 and start + dur <= DUR, f'{vid}: window {start}+{dur} outside 0..{DUR}'
        if not os.path.exists(os.path.join(ROOT, src)):
            warn(f'{vid}: {src} does not exist yet: clip LEFT OUT of index.html (re-run assemble.py once it lands)')
            continue
        vids.append(f'    <video id="{vid}" class="clip stage-v" src="{src}" data-start="{num(start)}" data-duration="{num(dur)}" '
                    f'data-media-start="{num(ms)}" data-track-index="{20 + len(vids)}" muted playsinline style="z-index:{z}"></video>')
        prev_end[vid] = start + dur

    # ---- sections
    secs = []
    for i, sid in enumerate(SCENES):
        f0, f1 = WIN[sid]
        p = os.path.join(ROOT, 'html', sid + '.html')
        frag = open(p).read().rstrip() if os.path.exists(p) else ''
        if not frag:
            warn(f'{sid}: html/{sid}.html missing or empty')
        body = ('\n' + '\n'.join('      ' + ln if ln.strip() else '' for ln in frag.splitlines()) + '\n    ') if frag else ''
        secs.append(f'    <section id="{sid}" class="clip scene" data-start="{num(f0 / FPS)}" data-duration="{num((f1 - f0) / FPS - 0.001)}" '
                    f'data-track-index="{1 + i}">{body}</section>')

    # ---- css (tokens, phone, scenes in order, then the rest)
    css_dir = os.path.join(ROOT, 'css')
    have = sorted(f for f in os.listdir(css_dir) if f.endswith('.css'))
    order = [f for f in ['tokens.css', 'phone.css'] if f in have] + [f'{s}.css' for s in SCENES if f'{s}.css' in have]
    order += [f for f in have if f not in order]
    # Everything is INLINED (url() paths root-relative). phone-screen.css loses its own @font-face (../../fonts).
    ps_css = re.sub(r'@font-face[^}]*}\s*', '', open(os.path.join(ROOT, 'assets/site/screen/phone-screen.css')).read())
    font_css = '\n'.join(f'@font-face {{ font-family: "{fa}"; src: url("assets/fonts/{fi}.woff2") format("woff2"); font-weight: {w}; font-display: block;'
                         + (f' unicode-range: {r[0]};' if r else '') + ' }' for fa, fi, w, *r in FONTS)
    blocks = [('fonts', font_css), ('assets/site/screen/phone-screen.css', ps_css)] + \
             [(f'css/{f}', open(os.path.join(css_dir, f)).read()) for f in order]
    for name, txt in blocks:
        assert '../' not in txt, f'{name}: no "../" in url() (CSS is inlined; use root-relative "assets/...")'
    css = [f'    <style data-src="{name}">\n{txt.strip()}\n    </style>' for name, txt in blocks]

    # ---- js
    scene_js = [f'js/scenes/{s}.js' for s in SCENES if os.path.exists(os.path.join(ROOT, 'js', 'scenes', s + '.js'))]
    for s in SCENES:
        if f'js/scenes/{s}.js' not in scene_js:
            warn(f'{s}: js/scenes/{s}.js missing')
    js = [f'    <script src="{p}"></script>' for p in LIBJS + scene_js + a.extra_js + ['js/main.js']]

    for p in PRELOAD:
        if not os.path.exists(os.path.join(ROOT, p)):
            warn(f'preload {p} does not exist yet')
    pre = [f'    <link rel="preload" as="image" href="{p}" />' for p in PRELOAD]
    audio = ''
    if os.path.exists(os.path.join(ROOT, 'assets/audio/mix.wav')):
        audio = f'    <audio id="mix" src="assets/audio/mix.wav" data-start="0" data-duration="{num(DUR)}" data-track-index="40" data-volume="1"></audio>\n'
    else:
        warn('assets/audio/mix.wav missing: index.html has no audio track yet')

    html = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>PurePeptide — "Spelled out" 45 s (EN, 16:9)</title>
    <!-- GENERATED by tools/assemble.py from html/*.html, css/*.css and js/ — edit those, not this file. -->
{chr(10).join(f'    <script src="{v}"></script>' for v in VENDOR)}
{chr(10).join(css)}
{chr(10).join(pre)}
  </head>
  <body>
  <div id="stage" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="{num(DUR)}">
    <div id="world" class="layer"><div class="w w-ink"></div><div class="w w-paper"></div><div class="w w-navy"></div></div>
{chr(10).join(vids)}
{chr(10).join(secs)}
    <div id="phone" class="layer"></div>
    <div id="fx" class="layer"><div id="vignette" class="layer"></div><div id="grain" class="layer"></div></div>
{audio}  </div>
{chr(10).join(js)}
    <script>
      // js/main.js builds the master timeline once the fonts are loaded (PP.ready); register it for HyperFrames.
      window.PP.ready.then(function (r) {{
        window.__timelines = window.__timelines || {{}};
        window.__timelines["main"] = r.tl;
        if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
      }});
    </script>
  </body>
</html>
'''
    out = os.path.join(ROOT, a.out)
    open(out, 'w').write(html)
    print(f'{a.out}: {len(SCENES)} scenes, {len(vids)} stage videos, {len(order)} css, {len(scene_js)} scene js'
          + (f', extra {a.extra_js}' if a.extra_js else ''))


if __name__ == '__main__':
    main()
