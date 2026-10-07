---
name: browser-demo-video
description: Produce a narrated, chaptered 1080p MP4 demo or walkthrough video of any browser-based product (web app, dashboard, internal tool, embedded artifact). It drives the real UI in Chrome with an on-screen cursor, highlight rings, notes and title cards, voices a scene script with TTS (Amazon Polly or macOS say), times every action to the narration, cuts loading waits, and mixes, normalises and chapters the result. Use it when asked to "create a demo video", "record a walkthrough", "make a screencast with voiceover", "product tour video" or to re-record or revoice an existing one.
---

# Browser demo video

You script the video as code, so takes are repeatable: a voice change or one fixed label means an automatic re-take, not a manual re-record. The pipeline:

```
script.cjs ──tts.cjs──▶ audio/*.wav + durations.json
     │                                │
     └──────────record.cjs◀───────────┘   Chrome + overlay, CDP screencast → takes/<target>/frames + timeline.json
                    │
               post.py  ──▶ MP4 (cuts removed, narration + click sounds, −16 LUFS, chapters)
                    │
               review.py ──▶ contact sheets + loudness/chapter check → you inspect, then deliver
```

Engine: `scripts/` in this skill. Per-video project: `~/Movies/Demos/<slug>/` (never `/tmp`, which gets wiped), holding `video.config.cjs`, `script.cjs`, `audio/` and `takes/`. Runnable example: `examples/hello-orders/` (a tiny page embedded in a host shell; use it to check your setup). **Read `references/lessons.md` before the first take.**

Requirements: Chrome, Node with Playwright (record.cjs finds it, or set `playwright` in the config), ffmpeg/ffprobe, Python 3, and the AWS CLI for Polly.

## 1. Agree the video (before any code)

Confirm, and propose an outline the user can react to:
- **Audience.** Internal videos cover roles, permissions, controls and known limits, and end with a "Things to know" chapter. Leadership and customer videos cover outcomes and the happy path only.
- **The flow end to end,** as chapters, and the target length. About 10–12 minutes suited an internal deep dive.
- **Where to record (decision).** The walkthrough clicks real buttons and writes real state, so it never runs on real, shared data. Recommend a copy, a test workspace, or a dev environment with realistic data, plus a way to reset it between takes. If making that copy writes to production, it needs an explicit yes.
- **Identities (decision).** If the flow needs two people (maker and checker), either a real teammate signs in to a second window, or one person plays both and the video says so on screen. Never create users or handle passwords; if a test account is needed, the user creates it.
- **Voice (decision).** The default is Polly generative "Amy" (en-GB), which held up well with real viewers. Offer a ~30 s sample of each candidate voice before generating everything:
  `aws polly synthesize-speech --profile <dev profile> --region eu-west-2 --engine generative --voice-id Amy --output-format mp3 --text "<passage with the product's jargon>" sample-Amy.mp3`
  Use a non-production AWS account. macOS `say` works offline but sounds synthetic. The user's own voice is the most natural option.
- **Framing.** Only the product is in frame: no host side panels, lists or banners. Set this up in the config's `setup` hook.

## 2. Set up the project

```bash
P=~/Movies/Demos/<slug>; K=~/.claude/skills/browser-demo-video
mkdir -p "$P" && cp $K/templates/video.config.cjs $K/templates/script.cjs "$P"/
```
In `video.config.cjs`, fill in: the url of the disposable environment, `frame` if the product runs in an iframe, `ready`, `setup` (framing), `theme` (product accent colour and footer), `voice`, and `helpers.waitLoaded` (the product's loaded signal).

Map the UI before writing steps. Open it, list stable selectors (ids, roles, `data-*`, visible text), and note slow loads. Prefer selectors built on displayed text (`tr:has-text("-1,250.00") [data-resolve]`) over generated keys.

## 3. Write the scene script

Each step has `{ id, chapter?, pre?, say?, act?, gap? }`. The `h` API is documented at the top of `templates/script.cjs`.
- **Narration drives the timing.** `act` runs while the clip plays, and `h.at(0.6)` lines a second action up with the words. Keep each `say` to one or two spoken sentences.
- **Write numbers as they're spoken** ("ninety-seven percent", "the fourteenth of September").
- **Use real decisions from real users** where they exist, so the figures on screen match what the team knows.
- **Put a chapter card (`h.card`) before each chapter,** and add rings with 3–6 word labels. Use `note()` only where a point needs making, such as a safety property, a caveat, or "in real use…".
- **Wrap every slow load in `h.cut(() => h.waitLoaded(), 'Loading …')`.** That span is removed in post-production.
- **Say every simplification on screen and in the narration.** For example, one person plays two roles: show the control blocking it, show the setting being changed "for this recording only", then explain what happens in real use.
- **Point at downloads; don't click them** (see lessons).

## 4. Generate the voiceover

`node $K/scripts/tts.cjs "$P"`. Only changed lines are regenerated. Claude can't listen to the result, so name the risky words (acronyms, names) and ask the user to check them. With macOS `say`, spell acronyms as letters ("S A P").

## 5. Dry run, then sign in, then record

1. **Dry run.** Point `TARGET=preview` with `previewUrl` at a local build if one exists. Otherwise run short segments on the disposable environment: `ONLY='^(c1|load0|where1)$' node $K/scripts/record.cjs "$P" record`. Check a few frames with the Read tool (`takes/prod/frames/*.jpg`, `failure.png` on errors), and check with ffprobe that the frames are 1920×1080. Reset the environment afterwards.
2. **Sign in.** Run `node $K/scripts/record.cjs "$P" login` with `run_in_background`. The user signs in in the window that opens, then closes it. If they say they're done but the window is still open, `pkill -INT -f "record.cjs.* login"`.
3. **Full take.** Reset the environment, then run `node $K/scripts/record.cjs "$P" record` with `run_in_background`. Before it starts, tell the user it takes about the narration length plus a third, in a visible Chrome window they must not click. Wait for the completion notification; don't poll with sleep. Check the log for every `ok` step and no `FAILED` or `CRASHED` line.

## 6. Assemble and review

```bash
python3 $K/scripts/post.py "$P/takes/prod" "$P/takes/prod/walkthrough.mp4"        # run_in_background; ~10 min for a 10-min video
python3 $K/scripts/review.py "$P/takes/prod" "$P/takes/prod/walkthrough.mp4" "$P/review"   # optional: step_id:0.8 picks
```
Read every `review/s*.jpg` sheet. Look for clipped or overlapping labels, rings on the wrong element, loading states that weren't cut, and leftover overlays. Loudness should be about −16 LUFS, and the chapter count should match the script. Fix problems in the script, reset the environment, and re-take. Re-takes are cheap.

## 7. Deliver and clean up

- **Deliver.** Copy the video to `$P/<slug>.mp4` and `open` it. If a previous version exists, keep it renamed (for example `old-<voice>-<slug>.mp4`), not overwritten.
- **Report.** Give the length, resolution, chapters, the voice, where it was recorded, every simplification shown, what you couldn't verify (the audio), and any visual flaws left in.
- **Ask before cleaning up.** Get the user's go-ahead before removing the disposable copy or environment, and before deleting `takes/` (frames take GBs). Keep `script.cjs`, the config and `audio/` so the video can be re-recorded later.
- **Record it.** If the work belongs to a ticket or notes file, note the video's location there and that the copy deletion is pending. Commit only that file.
