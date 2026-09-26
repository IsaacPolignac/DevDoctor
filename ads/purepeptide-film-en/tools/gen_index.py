#!/usr/bin/env python3
"""Writes index.html from the edit decision list below (SCENES.md). Every clip window is [in, out) on exact frame
times; durations are shortened by 1 ms so two clips never share a frame. Picture content is built in js/film.js."""
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# (id, in, out, kind, extra) kind: div | video(src, media_start, rate)
EDL = [
    ('s02', 1.6, 6.0, 'div'), ('s03', 6.0, 8.0, 'div'), ('s04', 8.0, 10.0, 'div'), ('s05', 10.0, 12.5, 'div'),
    ('s06', 12.5, 14.5, 'div'),
    ('s07a', 14.5, 15.5, 'div'), ('v07b', 15.5, 16.0, 'video', 'p3_shoulder.mp4', 0, 1), ('v07c', 16.0, 17.0, 'video', 'p3_cake.mp4', 0, 1),
    ('s07d', 17.0, 17.4, 'div'), ('v07e', 17.4, 17.9, 'video', 'p3_capridge.mp4', 0, 1), ('s07f', 17.9, 18.9, 'div'),
    ('v07g', 18.9, 19.4, 'video', 'p3_labelsweep.mp4', 0, 1), ('s07h', 19.4, 20.0, 'div'),
    ('v08', 20.0, 24.0, 'video', 'turntable_g.mp4', 0, 1),
    ('s09', 24.0, 27.0, 'div'),
    ('s10a', 27.0, 28.5, 'div'), ('s10b', 28.5, 30.0, 'div'), ('s10c', 30.0, 31.5, 'div'), ('s10d', 31.5, 33.0, 'div'),
    ('s11', 33.0, 36.0, 'div'), ('s12', 36.0, 38.0, 'div'), ('s13', 38.0, 39.0, 'div'),
    ('v14a', 39.0, 40.0, 'video', 'p3_orbit.mp4', 0, 1), ('v14b', 40.0, 41.0, 'video', 'turntable_g.mp4', 0, 2),
    ('v14c', 41.0, 42.0, 'video', 'p3_glide.mp4', 0, 1),
    ('s18', 42.0, 44.0, 'div'), ('s19', 44.0, 46.0, 'div'),   # promo: white studio (2 vials, 5 %) · brand blue (3+ vials, 8 %)
    ('s15', 46.0, 50.0, 'div'), ('s16', 50.0, 53.0, 'div'), ('s17', 53.0, 60.0, 'div'),
    # text layers (above picture)
    ('t09', 24.0, 27.0, 'text'), ('t10', 30.0, 33.0, 'text'), ('t11', 33.0, 36.0, 'text'), ('t14', 39.2, 41.0, 'text'),
]
PRELOAD = ['rim_full', 'macro_crimp', 'cap_full', 'hero_full', 'label_logo', 'cap_ribs', 'label_word', 'macro_shoulder', 'label_full',
           'macro_full', 's3_macro', 's3_cold', 's3_back']


def f(x):
    return ('%.4f' % x).rstrip('0').rstrip('.')


def main():
    rows = []
    for i, e in enumerate(EDL):
        cid, t0, t1, kind = e[:4]
        dur = f(t1 - t0 - 0.001)
        z = 10 + i
        if kind == 'video':
            src, ms, rate = e[4], e[5], e[6]
            extra = f' data-media-start="{f(ms)}"' + (f' data-playback-rate="{rate}"' if rate != 1 else '')
            rows.append(f'      <video id="{cid}" class="plate-v" src="assets/plates/{src}" data-start="{f(t0)}" data-duration="{dur}"{extra} data-track-index="2" muted playsinline style="z-index:{z}"></video>')
        elif kind == 'text':
            rows.append(f'      <div id="{cid}" class="clip type" data-start="{f(t0)}" data-duration="{dur}" data-track-index="3"></div>')
        else:
            rows.append(f'      <div id="{cid}" class="clip shot" data-start="{f(t0)}" data-duration="{dur}" data-track-index="1" style="z-index:{z}"></div>')
    pre = '\n'.join(f'    <link rel="preload" as="image" href="assets/plates/{p}.jpg" />' for p in PRELOAD)
    tpl = open(os.path.join(ROOT, 'tools', 'index.tpl.html')).read()
    out = tpl.replace('<!--CLIPS-->', '\n'.join(rows)).replace('<!--PRELOAD-->', pre)
    open(os.path.join(ROOT, 'index.html'), 'w').write(out)
    print('index.html:', len(EDL), 'clips')


if __name__ == '__main__':
    main()
