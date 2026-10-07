#!/usr/bin/env python3
"""Post-production: frames + timeline -> 1080p MP4 with voiceover, click sounds and chapters.
Usage: post.py <take-dir> <out.mp4>    (e.g. <project>/takes/prod)
SKIPV=1 reuses the existing video.mp4 and redoes audio, chapters and mux only."""
import json, os, subprocess, sys

take, out = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
tl = json.load(open(os.path.join(take, 'timeline.json')))
events, frames, info = tl['timeline'], tl['frames'], tl.get('meta', {})
audio_dir = info.get('audioDir') or os.path.join(take, '..', '..', 'audio')
T0 = next(e['t'] for e in events if e['type'] == 'start')
T1 = next(e['t'] for e in events if e['type'] == 'end')
cuts = sorted((e['t0'], e['t1']) for e in events if e['type'] == 'cut')

keep, a = [], T0
for c0, c1 in cuts:
    if c0 > a: keep.append((a, c0))
    a = max(a, c1)
keep.append((a, T1))

def out_time(t):
    """Recording time -> output time; None if t falls inside a cut."""
    acc = 0.0
    for k0, k1 in keep:
        if t < k0: return None
        if t <= k1: return acc + (t - k0)
        acc += k1 - k0
    return None

total = sum(k1 - k0 for k0, k1 in keep)

# Video: concat list of frames with display durations inside the kept intervals.
lst = os.path.join(take, 'frames.ffconcat')
with open(lst, 'w') as f:
    f.write('ffconcat version 1.0\n')
    last = None
    for k0, k1 in keep:
        prev = [fr for fr in frames if fr['t'] <= k0]
        seq = ([prev[-1]] if prev else []) + [fr for fr in frames if k0 < fr['t'] < k1]
        for i, fr in enumerate(seq):
            s = max(fr['t'], k0)
            e = seq[i + 1]['t'] if i + 1 < len(seq) else k1
            d = max(0.0, e - s)
            if d <= 0: continue
            f.write(f"file '{os.path.join(take, fr['f'])}'\nduration {d:.4f}\n"); last = fr
    f.write(f"file '{os.path.join(take, last['f'])}'\n")

video = os.path.join(take, 'video.mp4')
if not os.environ.get('SKIPV'): subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
    '-vf', f'fps=30,scale=1920:1080:flags=lanczos:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p,fade=t=in:st=0:d=0.6,fade=t=out:st={total - 1.2:.2f}:d=1.2',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-t', f'{total:.3f}', video], check=True)

# Audio: narration clips and click sounds placed at their output times.
click = os.path.join(take, 'click.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i',
    "aevalsrc='0.55*sin(2*PI*2300*t)*exp(-t*260)+0.25*sin(2*PI*900*t)*exp(-t*140)':d=0.06:s=48000", '-ac', '1', click], check=True)
clips = []
for e in events:
    if e['type'] == 'say':
        ot = out_time(e['t'])
        if ot is not None: clips.append((os.path.join(audio_dir, e['id'] + '.wav'), ot, 1.0))
    elif e['type'] == 'click':
        ot = out_time(e['t'])
        if ot is not None: clips.append((click, ot, 0.22))
args, filt = ['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-t', f'{total:.3f}', '-i', 'anullsrc=r=48000:cl=mono'], []
for i, (path, ot, vol) in enumerate(clips, start=1):
    args += ['-i', path]
    filt.append(f'[{i}:a]aresample=48000,volume={vol},adelay={int(ot * 1000)}[a{i}]')
mix = ''.join(f'[a{i}]' for i in range(1, len(clips) + 1))
filt.append(f'[0:a]{mix}amix=inputs={len(clips) + 1}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st={total - 1.2:.2f}:d=1.2[mix]')
fscript = os.path.join(take, 'mix.txt'); open(fscript, 'w').write(';\n'.join(filt))
audio = os.path.join(take, 'audio.wav')
subprocess.run(args + ['-/filter_complex', fscript, '-map', '[mix]', '-ar', '48000', '-t', f'{total:.3f}', audio], check=True)

# Chapters.
chaps = [(e['title'], out_time(e['t'])) for e in events if e['type'] == 'chapter']
chaps = [(t, s) for t, s in chaps if s is not None]
meta = os.path.join(take, 'chapters.txt')
with open(meta, 'w') as f:
    f.write(f";FFMETADATA1\ntitle={info.get('title', 'Walkthrough')}\nartist={info.get('artist', '')}\n")
    for i, (title, s) in enumerate(chaps):
        e = chaps[i + 1][1] if i + 1 < len(chaps) else total
        f.write(f'\n[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(s * 1000)}\nEND={int(e * 1000)}\ntitle={title}\n')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', audio, '-i', meta, '-map', '0:v', '-map', '1:a', '-map_metadata', '2', '-map_chapters', '2',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], check=True)
print(json.dumps({'out': out, 'minutes': round(total / 60, 2), 'cuts_s': round(sum(b - a for a, b in cuts), 1), 'clips': len(clips), 'chapters': [(t, round(s, 1)) for t, s in chaps]}))
