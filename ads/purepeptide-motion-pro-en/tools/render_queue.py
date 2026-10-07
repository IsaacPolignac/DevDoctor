#!/usr/bin/env python3
"""tools/render_queue.py — runs blender/queue.json sequentially (one Blender at a time, renders/3d/.lock).

  --dry            print the estimate (est_sf × frames per job, total) and exit
  --only id[,id]   run only these job ids (s02_test, s01_test, take_prev, s02, take, s01)
  --range a-b      override the range of every selected job
  --pct N / --samples N   overrides
  --preview        every job at --pct 50 --samples 6 --no-denoise, outputs under renders/3d/<id>_prev/
  --resume         skip frames already on disk (the default in the shot scripts; without it --force is passed)
  --no-post        do not run post_layers / encode_layers after the jobs
Logs: renders/3d/<id>/log.json (per frame s, written by the shot script) + renders/3d/queue.log (wall time per job).
Stops on the first failure (non-zero exit). After the last job of an id with "post": true, runs
  python3 tools/post_layers.py <id> && tools/encode_layers.sh <id>
"""
import argparse
import json
import os
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PY = '/home/user/DevDoctor/ads/purepeptide-blender/.venv/bin/python'
QUEUE = os.path.join(ROOT, 'blender', 'queue.json')
RENDERS = os.path.join(ROOT, 'renders', '3d')
LOCK = os.path.join(RENDERS, '.lock')


def nframes(rng):
    n = 0
    for part in str(rng).split(','):
        if '-' in part:
            a, b = part.split('-')
            n += int(b) - int(a) + 1
        elif part.strip():
            n += 1
    return n


def fmt(s):
    return '%d:%02d:%02d' % (s // 3600, (s % 3600) // 60, s % 60)


def lock_holder():
    if not os.path.exists(LOCK):
        return None
    try:
        pid = int(open(LOCK).read().split()[0])
        os.kill(pid, 0)
        return pid
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--only', default='')
    ap.add_argument('--range', default='')
    ap.add_argument('--pct', type=int, default=0)
    ap.add_argument('--samples', type=int, default=0)
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--resume', action='store_true')
    ap.add_argument('--no-post', action='store_true')
    ap.add_argument('--queue', default=QUEUE)
    a = ap.parse_args()
    q = json.load(open(a.queue))
    jobs = q['jobs']
    if a.only:
        keep = set(a.only.split(','))
        jobs = [j for j in jobs if j['id'] in keep]
    if a.range:
        for j in jobs:
            j['range'] = a.range
    total = 0.0
    print('%-10s %-32s %-12s %5s %4s %7s  %s' % ('id', 'script', 'range', 'frames', 'spp', 'est s/f', 'est'))
    for j in jobs:
        n = nframes(j['range'])
        sf = j['est_sf']
        if a.preview or j.get('preview'):
            sf = min(sf, max(1.0, sf * 0.25))
        est = n * sf
        total += est
        print('%-10s %-32s %-12s %5d %4s %7.1f  %s' % (j['id'], j['script'], j['range'], n, a.samples or j['samples'], sf, fmt(est)))
    print('TOTAL estimate %s (%.2f h)%s' % (fmt(total), total / 3600, '  ← over the 5 h cap: apply the trim ladder (BRIEF §9)' if total > 5 * 3600 else ''))
    if a.dry:
        return
    holder = lock_holder()
    if holder:
        print('another Blender holds the lock (pid %d); refusing to start' % holder)
        sys.exit(3)
    os.makedirs(RENDERS, exist_ok=True)
    qlog = open(os.path.join(RENDERS, 'queue.log'), 'a')
    posted = set()
    for i, j in enumerate(jobs):
        cmd = [PY, os.path.join(ROOT, j['script']), '--range', j['range'], '--pct', str(a.pct or j['pct']),
               '--samples', str(a.samples or j['samples']), '--pass', j.get('pass', 'beauty')]
        if a.preview or j.get('preview'):
            cmd.append('--preview')
        if not a.resume:
            cmd.append('--force')
        t0 = time.time()
        line = '[%s] START %s %s' % (time.strftime('%H:%M:%S'), j['id'], ' '.join(cmd[2:]))
        print(line, flush=True)
        qlog.write(line + '\n')
        qlog.flush()
        logp = os.path.join(RENDERS, '%s_%s.out' % (j['id'], j['range'].replace(',', '_')))
        with open(logp, 'w') as fh:
            rc = subprocess.call(cmd, cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT)
        dt = time.time() - t0
        n = nframes(j['range'])
        line = '[%s] END   %s rc=%d wall %s (%.1f s/f incl. startup; est %.1f)' % (time.strftime('%H:%M:%S'), j['id'], rc, fmt(dt), dt / max(1, n), j['est_sf'])
        print(line, flush=True)
        qlog.write(line + '\n')
        qlog.flush()
        if rc != 0:
            print('FAILED: see', logp)
            sys.exit(rc)
        last_of_id = all(k['id'] != j['id'] for k in jobs[i + 1:])
        if j.get('post') and last_of_id and not a.no_post and not (a.preview or j.get('preview')):
            for c in (['python3', os.path.join(ROOT, 'tools', 'post_layers.py'), j['id']],
                      ['bash', os.path.join(ROOT, 'tools', 'encode_layers.sh'), j['id']]):
                print('[%s] POST %s' % (time.strftime('%H:%M:%S'), ' '.join(c[1:])), flush=True)
                rc = subprocess.call(c, cwd=ROOT)
                qlog.write('post %s rc=%d\n' % (' '.join(c[1:]), rc))
                if rc != 0:
                    sys.exit(rc)
            posted.add(j['id'])
    print('queue done')


if __name__ == '__main__':
    main()
