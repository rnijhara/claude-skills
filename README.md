# claude-skills

A [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces) of skills.

```text
/plugin marketplace add rnijhara/claude-skills
/plugin install browser-demo-video@rnijhara-skills
```

## Skills

| Plugin | What it does |
|---|---|
| [`browser-demo-video`](plugins/browser-demo-video/skills/browser-demo-video/SKILL.md) | Produces a narrated, chaptered 1080p MP4 demo of any browser-based product. Claude drives the real UI in Chrome with an on-screen cursor, highlights, notes and title cards. It voices a scene script with TTS (Amazon Polly or macOS `say`), times each action to the narration, cuts loading waits, then mixes, normalises loudness and adds chapters. Re-takes are automatic: change a line or a voice and re-run. |

### browser-demo-video requirements

- macOS (for `say`), or Amazon Polly through the AWS CLI
- Google Chrome, Node.js with [Playwright](https://playwright.dev), ffmpeg/ffprobe and Python 3

Try it with `plugins/browser-demo-video/skills/browser-demo-video/examples/hello-orders/`.

## License

MIT
