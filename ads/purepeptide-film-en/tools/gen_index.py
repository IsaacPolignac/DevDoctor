#!/usr/bin/env python3
"""Writes index.html from the edit decision list below (SCENES.md). Every clip window is [in, out) on exact frame
times; durations are shortened by 1 ms so two clips never share a frame. Picture content is built in js/film.js."""
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# (id, in, out, kind, extra) kind: div | video(src, media_start, rate) | overlay | text
# Vial shots are AI video (assets/plates/ai/*.mp4, Kling O3 video edit: Blender animation as motion guide + the real vial
# photo as reference). Clip lengths: turn ~4.0 s, hero/cold/smoke/macro ~3.0 s, cap ~2.5 s — every window below keeps its
# last sampled frame at or before 3.9 s (turn), 2.9 s (hero/cold/smoke/macro), 2.4 s (cap), whence the < 1 rates.
# overlay = transparent timed layer that must sit ABOVE a stage-level video (haze, sweep, edge feather): listed after it.
AI = 'ai/'
EDL = [
    ('s02', 1.6, 6.0, 'div'),
    ('v03', 6.0, 8.0, 'video', AI + 'macro.mp4', 0, 1),
    ('v04', 8.0, 10.0, 'video', AI + 'cap.mp4', 0.3, 1), ('o04', 8.0, 10.0, 'overlay'),
    ('v05', 10.0, 12.5, 'video', AI + 'hero.mp4', 0.3, 1),
    ('s06', 12.5, 14.5, 'div'),
    ('v07a', 14.5, 15.5, 'video', AI + 'turn.mp4', 1.8, 1), ('v07b', 15.5, 16.0, 'video', AI + 'macro.mp4', 1.2, 1),
    ('v07c', 16.0, 17.0, 'video', AI + 'cap.mp4', 1.4, 1), ('v07d', 17.0, 17.4, 'video', AI + 'cap.mp4', 0.6, 1),
    ('v07e', 17.4, 17.9, 'video', AI + 'turn.mp4', 0.6, 1), ('v07f', 17.9, 18.9, 'video', AI + 'turn.mp4', 2.4, 1), ('o07f', 17.9, 18.9, 'overlay'),
    ('v07g', 18.9, 19.4, 'video', AI + 'hero.mp4', 2.0, 1), ('v07h', 19.4, 20.0, 'video', AI + 'macro.mp4', 2.2, 1),
    ('v08', 20.0, 24.0, 'video', AI + 'turn.mp4', 0, 0.97),
    ('v09', 24.0, 27.0, 'video', AI + 'hero.mp4', 0, 0.96), ('o09', 24.0, 27.0, 'overlay'),
    ('v10a', 27.0, 28.5, 'video', AI + 'turn.mp4', 0.2, 1), ('v10b', 28.5, 30.0, 'video', AI + 'macro.mp4', 0.6, 1),
    ('v10c', 30.0, 31.5, 'video', AI + 'cap.mp4', 0.8, 1), ('v10d', 31.5, 33.0, 'video', AI + 'hero.mp4', 1.2, 1), ('o10', 30.0, 33.0, 'overlay'),
    ('v11', 33.0, 36.0, 'video', AI + 'cold.mp4', 0, 0.95), ('o11', 33.0, 36.0, 'overlay'),
    ('s12', 36.0, 38.0, 'div'),
    ('v13', 38.0, 39.0, 'video', AI + 'hero.mp4', 1.88, 1),
    ('v14a', 39.0, 40.0, 'video', AI + 'turn.mp4', 0, 2), ('v14b', 40.0, 41.0, 'video', AI + 'turn.mp4', 1.95, 2),
    ('v14c', 41.0, 42.0, 'video', AI + 'macro.mp4', 0, 1.5),
    ('s18', 42.0, 44.0, 'div'), ('s19', 44.0, 46.0, 'div'),   # promo: white studio (2 vials, 5 %) · brand blue (3+ vials, 8 %)
    ('s15', 46.0, 50.0, 'div'),
    ('v16', 50.0, 53.0, 'video', AI + 'smoke.mp4', 0, 0.95), ('o16', 50.0, 53.0, 'overlay'),
    ('s17', 53.0, 60.0, 'div'),
    # text layers (above picture)
    ('t09', 24.0, 27.0, 'text'), ('t10', 30.0, 33.0, 'text'), ('t11', 33.0, 36.0, 'text'), ('t14', 39.2, 41.0, 'text'),
]
PRELOAD = ['rim_full']
AI_LAST = {'turn.mp4': 3.9, 'hero.mp4': 2.9, 'cold.mp4': 2.9, 'smoke.mp4': 2.9, 'macro.mp4': 2.9, 'cap.mp4': 2.4}  # latest safe seek, s


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
            last = ms + (t1 - t0 - 1 / 30) * rate  # media time of the window's last frame
            lim = AI_LAST.get(src[len(AI):]) if src.startswith(AI) else None
            assert lim is None or last <= lim + 1e-6, f'{cid}: seeks {last:.3f} s into {src} (limit {lim} s)'
            extra = f' data-media-start="{f(ms)}"' + (f' data-playback-rate="{rate}"' if rate != 1 else '')
            rows.append(f'      <video id="{cid}" class="plate-v" src="assets/plates/{src}" data-start="{f(t0)}" data-duration="{dur}"{extra} data-track-index="2" muted playsinline style="z-index:{z}"></video>')
        elif kind == 'overlay':
            rows.append(f'      <div id="{cid}" class="clip layer" data-start="{f(t0)}" data-duration="{dur}" data-track-index="4" style="z-index:{z}"></div>')
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
