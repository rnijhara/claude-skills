#!/usr/bin/env python3
"""Review a finished take: grab frames at narrated steps, tile them into 2x2 contact sheets, report loudness and chapters.
Usage: review.py <take-dir> <video.mp4> <out-dir> [step_id:fraction ...]
With no steps, samples ~24 narrated steps evenly at 80% of their narration. Read the sheets with the Read tool."""
import json, os, re, subprocess, sys

take, video, out = (os.path.abspath(a) for a in sys.argv[1:4])
picks = [(a.split(':')[0], float(a.split(':')[1])) for a in sys.argv[4:]]
tl = json.load(open(os.path.join(take, 'timeline.json')))
ev = tl['timeline']
T0 = next(e['t'] for e in ev if e['type'] == 'start')
T1 = next(e['t'] for e in ev if e['type'] == 'end')
cuts = sorted((e['t0'], e['t1']) for e in ev if e['type'] == 'cut')
keep, a = [], T0
for c0, c1 in cuts:
    if c0 > a: keep.append((a, c0))
    a = max(a, c1)
keep.append((a, T1))

def out_time(t):
    acc = 0.0
    for k0, k1 in keep:
        if t < k0: return None
        if t <= k1: return acc + t - k0
        acc += k1 - k0
    return None

says = [e for e in ev if e['type'] == 'say']
if not picks:
    step = max(1, len(says) // 24)
    picks = [(e['id'], 0.8) for e in says[::step]]
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if re.match(r'^(f\d+|s\d+)\.jpg$', f): os.remove(os.path.join(out, f))
n = 0
for sid, frac in picks:
    e = next((x for x in says if x['id'] == sid), None)
    t = e and out_time(e['t'] + e['dur'] * frac)
    if t is None: print('skip', sid); continue
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{t:.2f}', '-i', video, '-frames:v', '1', '-vf', 'scale=960:-1', os.path.join(out, f'f{n:02d}.jpg')], check=True)
    print(f'f{n:02d}.jpg', sid, f'{t:.1f}s'); n += 1
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(out, 'f%02d.jpg'), '-vf', 'tile=2x2', os.path.join(out, 's%d.jpg')], check=True)
print('sheets:', ' '.join(sorted(f for f in os.listdir(out) if f.startswith('s'))))
r = subprocess.run(['ffmpeg', '-v', 'info', '-i', video, '-vn', '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)
print('integrated loudness:', (m[-1] + ' LUFS (target -16)') if m else 'unknown')
p = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-show_chapters', '-of', 'json', video], capture_output=True, text=True)
info = json.loads(p.stdout)
v = next((s for s in info.get('streams', []) if s.get('width')), {})
print('video:', f"{v.get('width')}x{v.get('height')}", f"{float(info['format']['duration']) / 60:.1f} min,", len(info.get('chapters', [])), 'chapters')
