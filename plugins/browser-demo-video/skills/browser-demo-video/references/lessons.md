# Lessons from past demo videos

These come from the first video made with this process: a 10-minute internal walkthrough of a finance workflow app embedded in a host platform. Each item cost a failed take or a round-trip. Read them before the first recording.

## Viewer preferences that held up
- **Only the product in frame.** No host-app side panels, lists or browser chrome. A production take was stopped because a list of other items was visible. Use the config's `setup` hook to hide them (for example, click the product's full-screen button with `emulateFullscreen: true`, which emulates it in the page so the display isn't taken over).
- **Voice: Amazon Polly generative "Amy" (en-GB)**, from a **dev** AWS account (eu-west-2). The macOS "Jamie (Premium)" voice was rejected as "not great". Before changing voice, send a ~30 s sample of each candidate (Amy, Brian) to the project folder and let the user choose.
- **Internal videos are explicit about roles, permissions, controls and known limits.** Leadership versions leave them out. Close internal videos with a "Things to know" chapter.
- **Simplifications are said out loud.** The owner approved one person playing Preparer and Approver. The video still showed separation of duties blocking self-approval, then the Owner switching it off "for this recording only", and the narration said a different Approver does it in real use.

## Safety and access
- **Never record on real, shared data.** A walkthrough clicks real buttons and writes real state. Record on a copy, a test workspace or a dev environment that has realistic data, and reset it between takes. Creating that copy in production is a production write: say exactly what it writes, and wait for a yes. The first attempt was rejected because it wasn't explained, then approved once it was.
- **Don't create production test users, and never handle passwords.** If a second identity is needed, a real teammate signs in to a second window. A password account in production that bypasses SSO is the fallback, and the user creates it.
- **The user signs in once, through `record.cjs <project> login`,** into a dedicated Chrome profile (`~/.cache/browser-demo-video/chrome-profile`). If they say "signed in" but the window stays open, `pkill -INT -f "record.cjs .* login"` closes it cleanly and keeps the session.
- **The copy goes stale.** The copy keeps the product version it was made from. When the real product changes, make a new copy. The cash-actuals copy fell behind at revision 3 while the app moved on to revision 7.
- **Commit only the file you mean to.** `git commit -a` once swept in an unrelated, uncommitted ticket. Use `git commit -- <path>`.

## Recording
- **Headed Chrome is needed for 2x frames.** Headless screencast frames came out at CSS size (1536 px) and headed at retina size (3072 px). Use headless only for quick selector checks.
- **The viewport has to fit on the display.** A 1536×864 window got clamped on a 2560×1440 display, so frames came out 1839×1080. 1440×810 is safe there. Before a full take, confirm with `ffprobe` that the frames are 1920×1080.
- **Use selectors based on displayed text.** Selectors built from data keys broke (`[data-resolve*="|EUR|-1250"]`); `tr:has-text("-1,250.00") [data-resolve]` worked.
- **Avoid triggering downloads in takes.** Clicking a CSV export inside a sandboxed iframe was followed by the browser context closing at 535 s. Point at the export button and narrate it instead.
- **Write the timeline after every step** (record.cjs does this), so a crashed take still leaves a usable partial timeline and `failure.png`.
- **Show the opening card before the screencast starts** (`introCard`), so the first frame is the title and not the app loading.
- **Wrap slow loads in `h.cut()`.** A badge reads "wait cut from the video" and post.py removes that span (22 s of the cash-actuals take).
- **Leave the window alone.** A full take ran about 11–12 minutes in a visible window. Tell the user not to click in it. Run it with `run_in_background` and wait for the notification; don't use foreground `sleep`.
- **Dry-run first.** Use a local preview if one exists. Otherwise run short `ONLY='^(c1|load0|where1)$'` segments against the copy, check frames, then reset the copy.

## Voice
- **Polly reads common acronyms (SAP, CSV) correctly.** macOS `say` doesn't: spell them out ("S A P").
- **`say -o /dev/null` fails** with "Speaking failed: -241". Always write to a file.
- **Silence trimming matters.** tts.cjs trims leading and trailing silence, so the visuals sync to the words, not to padding.
- **Claude can't listen to the audio.** Ask the user to check pronunciation, and name the risky words.

## Post-production
- **ffmpeg 9 removed `-filter_complex_script`.** Use `-/filter_complex <file>` (post.py does).
- **ffconcat needs absolute frame paths** (post.py takes absolute paths).
- **Target loudness is −16 LUFS integrated.** Check it with review.py.
- **Review contact sheets for every chapter before sending.** That review caught three label problems: a label clipped at the left edge, a label covering the chosen value, and two labels crowding each other. The overlay now keeps labels inside the viewport. Use `place: 'below'` and `unring()` between rings to avoid overlaps.

## Environment
- **macOS has no `timeout` command, and zsh errors on globs that match nothing.** Guard with `mkdir -p` and explicit file lists.
- **Bash cwd resets after each call.** `cd` inside the same command.
- **`/private/tmp` is wiped.** The first video's scripts were lost there. Keep project files under `~/Movies/Demos/<slug>/`.
