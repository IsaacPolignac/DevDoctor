#!/usr/bin/env bash
# Verifies a rendered deliverable against BRIEF.md §2/§6/§8: 1080x1920, 30 fps, 30.00 s (900 frames),
# audio -14 LUFS integrated (±1), true peak <= -1 dBTP.
set -euo pipefail
f="${1:-renders/purepeptide-30s-saas-fr.mp4}"
test -s "$f" || { echo "FAIL missing $f"; exit 1; }
v=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=width,height,r_frame_rate,nb_read_frames,codec_name,pix_fmt -of default=nw=1 "$f")
d=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")
echo "$v"; echo "duration=$d"
a=$(ffmpeg -hide_banner -nostats -i "$f" -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 | tail -14)
echo "$a"
fail=0
grep -q "width=1080" <<<"$v" && grep -q "height=1920" <<<"$v" || { echo "FAIL size"; fail=1; }
grep -q "r_frame_rate=30/1" <<<"$v" || { echo "FAIL fps"; fail=1; }
grep -q "nb_read_frames=900" <<<"$v" || { echo "FAIL frame count"; fail=1; }
awk -v d="$d" 'BEGIN{exit !(d>=29.99 && d<=30.05)}' || { echo "FAIL duration"; fail=1; }
I=$(grep -E "^\s+I:" <<<"$a" | awk '{print $2}')
TP=$(grep -E "^\s+Peak:" <<<"$a" | awk '{print $2}')
awk -v i="$I" 'BEGIN{exit !(i>=-15 && i<=-13)}' || { echo "FAIL loudness $I LUFS"; fail=1; }
awk -v p="$TP" 'BEGIN{exit !(p<=-1.0)}' || { echo "FAIL true peak $TP dBTP"; fail=1; }
[ $fail -eq 0 ] && echo "PASS: 1080x1920 · 30 fps · 900 frames · ${d}s · ${I} LUFS · TP ${TP} dBTP"
exit $fail
