// Scene script. Each step: `id` (unique, also the audio filename), optional `chapter` (embedded MP4 chapter),
// `pre` (runs before the narration starts: cards, tab switches), `say` (one narration clip), `act` (runs while it plays),
// `gap` (ms of silence after; default 450 after narration). Steps without `say` hold slow waits wrapped in h.cut().
// Inside act, h.at(0.6) waits until 60% of this step's narration, to time a second action to the words.
//
// h API: loc(sel) · click(x) · type(x, text) · select(x, value) · point(x) · ring(x, { label, place: 'above'|'below',
// align: 'right', pad, spot: true }) · unring() · note(html, { kicker, right }) · unnote() · card({ kicker, title, sub,
// bullets, step, big }) · uncard() · cursor(true) · scrollIn(x, dy) · wait(ms) · at(frac) · cut(fn, label) ·
// area('viewport'|'frame'|'aboveFrame'|<config area>|{x,y,width,height}) · plus helpers from video.config.cjs.
const INTRO = { kicker: 'Internal walkthrough', title: '<App name>', sub: '<One sentence: who uses it, for what.>', big: true };

module.exports = [
  // ---------- Intro ----------
  { id: 'intro1', chapter: 'Introduction', introCard: INTRO,   // introCard is shown instantly, so frame one is the title
    say: 'This is an internal walkthrough of <App name>, which <team> uses to <job>.' },
  { id: 'intro2', pre: h => h.card({ kicker: 'Before we start', title: 'Recorded on a copy of the app', bullets: ['<Where the data comes from>', '<Any simplification, e.g. one person plays two roles>'] }),
    say: 'This was recorded on a copy of the app, with real data.' },

  // ---------- 1. Where it lives ----------
  { id: 'c1', chapter: 'Where the app lives', pre: h => h.card({ kicker: 'Chapter 1', title: 'Where the app lives', step: '01' }), say: 'First, where the app lives.' },
  { id: 'load0', act: async h => { await h.uncard(); await h.cut(() => h.waitLoaded(), 'Loading live data'); } },
  { id: 'where1', act: async h => { await h.cursor(true); await h.ring(h.loc('nav').first(), { label: '<Where to find it>', place: 'below' }); await h.at(0.6); await h.unring(); await h.ring(h.area('viewport'), { label: '<What it is>', place: 'above', align: 'right', pad: 0 }); },
    say: '<Where people find the product, and what it does in one sentence.>' },

  // ---------- 2..n: one chapter per part of the workflow ----------
  // { id: 'c2', chapter: '<Chapter>', pre: async h => { await h.unring(); await h.card({ kicker: 'Chapter 2', title: '<Chapter>', step: '02' }); }, say: '<Short lead-in.>' },
  // { id: 'x1', pre: h => h.uncard(), act: async h => { await h.click(h.loc('#someTab')); await h.ring(h.loc('#panel table'), { label: '<3-6 words>' }); }, say: '<One or two sentences.>' },

  // ---------- Things to know (internal audiences) ----------
  // { id: 'know', chapter: 'Things to know', pre: h => h.card({ kicker: 'For the team', title: 'Things to know', bullets: ['<limit 1>', '<limit 2>'] }), say: '...' },

  { id: 'outro', chapter: 'Summary', pre: h => h.card({ kicker: '<App name>', title: '<Three-beat summary.>', big: true }),
    say: '<One-sentence wrap-up.>', gap: 1800 },
];
