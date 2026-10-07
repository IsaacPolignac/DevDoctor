#!/usr/bin/env python3
"""Builds index.html (SHOTS §0.1, §0.7, §0.8) from:
  - html/<id>.html  shot markup fragments (one <section class="clip scene" id="<id>"> per shot, window from SHOTS §1)
  - css/*.css       tokens.css, phone.css first, then the shot sheets in shot order, then any other sheet
  - MEDIA below     stage-level <video>/<img> clips of the §0.7 z-stack (never nested in a timed section); media whose
                    file does not exist yet is LEFT OUT with a WARN (re-run once it lands)
  - js/             vendor GSAP, cues (if present), vo, lib, phone-screen, phone, screen_tl, shots/<id>.js in order, main.js
Edit those sources, never index.html.   Usage: python3 tools/assemble.py [--out index.html] [--extra-js path ...]
--extra-js appends scripts after the shots (used by temporary tests; never for the shipped index.html)."""
import argparse
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FPS = 30
DUR = 45.0
SHOTS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13']
# Shot windows in frames [in, out) — SHOTS §1 (same table as PP.WIN in js/lib.js)
WIN = {'S01': (0, 126), 'S02': (126, 216), 'S03': (216, 306), 'S04': (306, 396), 'S05': (396, 546), 'S06': (546, 636),
       'S07': (636, 738), 'S08': (738, 822), 'S09': (822, 936), 'S10': (936, 1044), 'S11': (1044, 1152), 'S12': (1152, 1206),
       'S13': (1206, 1350)}
# Stage-level videos (SHOTS §0.7): id, src, data-start, data-duration, data-media-start, z, seek limit (last usable media s)
VIDEOS = [
    ('v-s01', 'assets/layers/s01.mp4', 1.0, 3.2, 0.0, 10, 97 / 30),          # opaque; file starts at f30 (3 black frames inside)
    ('v-hero', 'assets/plates/ai/hero.mp4', 7.2, 3.0, 0.0, 10, 3.0417),       # 73 f @ 24 fps
    ('v-cap', 'assets/plates/ai/cap.mp4', 10.2, 3.0, 0.0, 10, 3.0417),
    ('v-turn', 'assets/plates/ai/turn.mp4', 13.2, 3.9, 0.0, 10, 4.0417),       # 97 f @ 24 fps
    ('v-macro', 'assets/plates/ai/macro.mp4', 18.2, 3.04, 0.0, 10, 3.0417),    # ends f637; #hold-macro continues
    ('v-frost', 'assets/fx/frost.webm', 21.6, 2.0, 0.0, 15, 2.0),              # VP9 alpha, mix-blend-mode: screen (css)
    ('v-s02', 'assets/layers/s02.webm', 4.2, 3.0, 0.0, 30, 90 / 30),
    ('v-take', 'assets/layers/take.webm', 23.6, 16.0, 0.0, 30, 481 / 30),       # f708–f1188; frost/shadow/soft-clip baked in
]
# Stage-level stills (opacity 0 until a shot switches them on): id, src, z, who drives it
IMAGES = [
    ('hold-macro', 'assets/plates/macro_last.png', 11, 'S06/S07: the held macro frame f637–f738 (2D push 1.00 → 1.04)'),
    ('frost-full', 'assets/fx/frost_full.png', 15, 'S07: frost_full held f708–f738 (screen blend), crushed to black f716–f738'),
    ('hold-1188', 'assets/layers/hold_1188.png', 31, 'S12: the STOP frame f1188–f1206 (above the take webm)'),
]
PRELOAD = ['assets/iphone/front_shadow.png', 'assets/iphone/front_body.png', 'assets/iphone/front_glass.png',
           'assets/site/clean/screen_blank.png', 'assets/site/clean/home.png', 'assets/site/clean/product.png',
           'assets/site/clean/cart1.png', 'assets/site/clean/cart2.png', 'assets/site/clean/cart3.png',
           'assets/brand/brand-symbol.svg', 'assets/brand/brand-wordmark-light.svg'] + \
          [f'assets/fx/grain{i}.png' for i in range(8)]
VENDOR = ['assets/vendor/gsap.min.js', 'assets/vendor/DrawSVGPlugin.min.js', 'assets/vendor/CustomEase.min.js']
FONTS = [  # (family, file, weight[, unicode-range]) — BRIEF §4
    ('DM Sans', 'dm-sans-latin-700-normal', '700'), ('DM Sans', 'dm-sans-latin-800-normal', '800'),
    ('Inter', 'inter-latin-400-normal', '400'), ('Inter', 'inter-latin-500-normal', '500'),
    ('Inter', 'inter-latin-600-normal', '600'), ('Inter', 'inter-latin-700-normal', '700'),
    ('IBM Plex Mono', 'ibm-plex-mono-latin-500-normal', '500'),
    # ≥ and the narrow no-break space are missing from the latin subsets. U+2212 minus IS in DM Sans and Inter.
    ('PP Symbols', 'inter-symbols', '100 900', 'U+202F, U+2264-2265'),
]
SVGS = {'symbol': 'assets/brand/brand-symbol.svg', 'wordmark': 'assets/brand/brand-wordmark-light.svg'}  # inlined as <template> for PP.inlineSvg
LIBJS = ['js/cues.js', 'js/vo.js', 'js/lib.js', 'assets/site/screen/phone-screen.js', 'js/phone.js', 'js/screen_tl.js']
# Chromatic aberration filter (PP.ca): R shifted +dx, B shifted −dx, screen-added. Applied to ONE element only.
FXDEFS = '''    <svg id="fxdefs" aria-hidden="true" width="0" height="0">
      <filter id="ca" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r0" />
        <feOffset id="ca-r" in="r0" dx="0" dy="0" result="r" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b0" />
        <feOffset id="ca-b" in="b0" dx="0" dy="0" result="b" />
        <feBlend in="r" in2="g" mode="screen" result="rg" />
        <feBlend in="rg" in2="b" mode="screen" />
      </filter>
    </svg>'''


def num(x):
    return ('%.4f' % x).rstrip('0').rstrip('.')


def warn(msg):
    print('WARN', msg, file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='index.html')
    ap.add_argument('--extra-js', nargs='*', default=[])
    a = ap.parse_args()

    # ---- stage media (videos + stills) with the seek-limit asserts
    media = []
    track = 20
    for vid, src, start, dur, ms, z, lim in VIDEOS:
        last = ms + dur - 1 / FPS  # media time of the clip's last frame
        assert last <= lim + 1e-6, f'{vid}: last frame seeks {last:.3f} s into {src} (limit {lim:.3f} s)'
        assert ms >= 0 and start >= 0 and start + dur <= DUR + 1e-9, f'{vid}: window {start}+{dur} outside 0..{DUR}'
        if not os.path.exists(os.path.join(ROOT, src)):
            warn(f'{vid}: {src} does not exist yet: clip LEFT OUT of index.html (re-run assemble.py once it lands)')
            continue
        media.append(f'    <video id="{vid}" class="clip stage-v" src="{src}" data-start="{num(start)}" data-duration="{num(dur)}" '
                     f'data-media-start="{num(ms)}" data-track-index="{track}" muted playsinline style="z-index:{z}"></video>')
        track += 1
    for iid, src, z, who in IMAGES:
        if not os.path.exists(os.path.join(ROOT, src)):
            warn(f'{iid}: {src} does not exist yet: still LEFT OUT of index.html ({who})')
            continue
        media.append(f'    <img id="{iid}" class="stage-img" src="{src}" alt="" style="z-index:{z}" />  <!-- {who} -->')

    # ---- sections
    secs = []
    for i, sid in enumerate(SHOTS):
        f0, f1 = WIN[sid]
        p = os.path.join(ROOT, 'html', sid + '.html')
        frag = open(p).read().rstrip() if os.path.exists(p) else ''
        if not frag:
            warn(f'{sid}: html/{sid}.html missing or empty')
        body = ('\n' + '\n'.join('      ' + ln if ln.strip() else '' for ln in frag.splitlines()) + '\n    ') if frag else ''
        secs.append(f'    <section id="{sid}" class="clip scene" data-start="{num(f0 / FPS)}" data-duration="{num((f1 - f0) / FPS - 0.001)}" '
                    f'data-track-index="{1 + i}">{body}</section>')

    # ---- css (tokens, phone, shots in order, then the rest)
    css_dir = os.path.join(ROOT, 'css')
    have = sorted(f for f in os.listdir(css_dir) if f.endswith('.css'))
    order = [f for f in ['tokens.css', 'phone.css'] if f in have] + [f'{s}.css' for s in SHOTS if f'{s}.css' in have]
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
    libjs = []
    for p in LIBJS:
        if os.path.exists(os.path.join(ROOT, p)):
            libjs.append(p)
        else:
            warn(f'{p} missing' + (' (provisional PP.CUES used until the music is measured)' if 'cues' in p else ''))
    shot_js = [f'js/shots/{s}.js' for s in SHOTS if os.path.exists(os.path.join(ROOT, 'js', 'shots', s + '.js'))]
    for s in SHOTS:
        if f'js/shots/{s}.js' not in shot_js:
            warn(f'{s}: js/shots/{s}.js missing')
    js = [f'    <script src="{p}"></script>' for p in libjs + shot_js + a.extra_js + ['js/main.js']]

    pre = []
    for p in PRELOAD + [src for _, src, _, _ in IMAGES]:
        if os.path.exists(os.path.join(ROOT, p)):
            pre.append(f'    <link rel="preload" as="image" href="{p}" />')
        else:
            warn(f'preload {p} does not exist yet')
    audio = ''
    if os.path.exists(os.path.join(ROOT, 'assets/audio/mix.wav')):
        audio = f'    <audio id="mix" src="assets/audio/mix.wav" data-start="0" data-duration="{num(DUR)}" data-track-index="40" data-volume="1"></audio>\n'
    else:
        warn('assets/audio/mix.wav missing: index.html has no audio track yet')

    tpl = []
    for k, src in SVGS.items():
        fp = os.path.join(ROOT, src)
        if not os.path.exists(fp):
            warn(f'svg {src} missing (PP.inlineSvg("{k}") will throw)')
            continue
        svg = open(fp).read()
        svg = re.sub(r'<\?xml[^>]*\?>\s*', '', svg).strip()
        tpl.append(f'    <template id="svg-{k}">{svg}</template>')

    html = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>PurePeptide — "A Line of Light" 45 s (EN, 16:9)</title>
    <!-- GENERATED by tools/assemble.py from html/*.html, css/*.css and js/ — edit those, not this file. -->
{chr(10).join(f'    <script src="{v}"></script>' for v in VENDOR)}
{chr(10).join(css)}
{chr(10).join(pre)}
  </head>
  <body>
  <div id="stage" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="{num(DUR)}">
{FXDEFS}
{chr(10).join(tpl)}
    <div id="world" class="layer"><div class="glow"></div></div>
{chr(10).join(media)}
    <div id="type-back" class="layer"></div>
{chr(10).join(secs)}
    <div id="phone2d" class="layer"></div>
    <div id="leak" class="layer"></div>
    <div id="type-front" class="layer"></div>
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
    print(f'{a.out}: {len(SHOTS)} shots, {len(media)} stage media, {len(order)} css, {len(shot_js)} shot js'
          + (f', extra {a.extra_js}' if a.extra_js else ''))


if __name__ == '__main__':
    main()
