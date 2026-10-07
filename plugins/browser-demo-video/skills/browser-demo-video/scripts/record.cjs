// Drives an app with an on-screen cursor, records it with a CDP screencast, and logs a timeline for post-production.
// Works on any browser-based product: a URL, an optional iframe the product runs in, and an optional setup hook.
//   node record.cjs <project> login     headed Chrome on the target URL; the user signs in, then closes the window
//   node record.cjs <project> record    records <project>/script.cjs into <project>/takes/<target>
// Env: TARGET=prod|preview (default prod), ONLY=<regex of step ids>, HEADLESS=1 (frames at 1x only; quick checks)
const fs = require('fs'), path = require('path'), os = require('os');
const PROJ = path.resolve(process.argv[2] || '.'), MODE = process.argv[3] || 'record';
const CFG = require(path.join(PROJ, 'video.config.cjs'));
const { chromium } = (() => { for (const p of [CFG.playwright, 'playwright'].filter(Boolean)) { try { return require(p); } catch (e) {} }
  throw Error('Playwright not found: set `playwright` in video.config.cjs to a node_modules/playwright path'); })();
const TARGET = process.env.TARGET || 'prod';
const URL = TARGET === 'prod' ? CFG.url : CFG.previewUrl;
if (!URL) { console.error(`No URL configured for TARGET=${TARGET}`); process.exit(1); }
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const PROFILE = CFG.profileDir || path.join(os.homedir(), '.cache/browser-demo-video/chrome-profile');
const FRAME = TARGET === 'prod' ? (CFG.frame || null) : (CFG.previewFrame || null);   // selector of the iframe the product runs in, if any
const OUT = path.join(PROJ, 'takes', TARGET);
const VW = (CFG.viewport || {}).width || 1440, VH = (CFG.viewport || {}).height || 810;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now() / 1000;

(async () => {
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: process.env.HEADLESS === '1', viewport: { width: VW, height: VH }, deviceScaleFactor: 2,
    bypassCSP: true, acceptDownloads: true, colorScheme: 'light', locale: CFG.locale || 'en-GB', timezoneId: CFG.timezone || 'Europe/London',
    args: ['--hide-scrollbars', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--window-position=40,40']
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  if (MODE === 'login'){
    await page.goto(URL);
    console.log('Sign in in the window, wait for the app to appear, then close the window.');
    await new Promise(r => ctx.on('close', r));
    return;
  }
  const STEPS = require(path.join(PROJ, 'script.cjs'));
  const DUR = JSON.parse(fs.readFileSync(path.join(PROJ, 'audio/durations.json')));
  const missing = STEPS.filter(s => s.say && !(DUR[s.id] && DUR[s.id].text === s.say)).map(s => s.id);
  if (missing.length) { console.error('Narration out of date; run tts.cjs first:', missing.join(', ')); process.exit(1); }

  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + '/frames', { recursive: true });
  const errors = [];
  page.on('pageerror', e => errors.push('page: ' + e.message));
  page.on('crash', () => console.error('PAGE CRASHED')); ctx.on('close', () => console.error('BROWSER CONTEXT CLOSED at', new Date().toISOString()));
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  page.on('download', d => d.saveAs(path.join(OUT, d.suggestedFilename())).catch(() => {}));
  if (TARGET === 'preview' && CFG.previewInit) await page.addInitScript(CFG.previewInit);
  if (CFG.emulateFullscreen){
    // The page's own requestFullscreen(), emulated in the page so the recording window does not take over the display.
    await page.addInitScript(() => { let fs = null; Object.defineProperty(Document.prototype, 'fullscreenElement', { get(){ return fs; }, configurable: true });
      Element.prototype.requestFullscreen = function(){ fs = this; this.dataset.fsPrev = this.getAttribute('style') || ''; Object.assign(this.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '2147483000', background: '#fff' }); setTimeout(() => this.dispatchEvent(new Event('fullscreenchange', { bubbles: true })), 0); return Promise.resolve(); };
      Document.prototype.exitFullscreen = function(){ const el = fs; fs = null; if (el) el.setAttribute('style', el.dataset.fsPrev || ''); setTimeout(() => (el || document).dispatchEvent(new Event('fullscreenchange', { bubbles: true })), 0); return Promise.resolve(); }; });
  }
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  if (FRAME) await page.waitForSelector(FRAME, { timeout: 60000 }).catch(() => { throw Error('The product did not open (not signed in?). Run: node record.cjs <project> login'); });
  if (CFG.ready) await page.waitForSelector(CFG.ready, { timeout: 60000 }).catch(() => { throw Error(`Ready selector ${CFG.ready} not found (not signed in?). Run: node record.cjs <project> login`); });
  // Product-specific framing before recording: hide chrome, dismiss banners, enter a full-screen view, assert layout.
  if (CFG.setup) await CFG.setup({ page, frame: FRAME, sleep, VW, VH });
  await page.evaluate(t => { window.__ovTheme = t; }, CFG.theme || {});
  await page.evaluate(fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8'));
  const ov = (fn, ...a) => page.evaluate(([fn, a]) => window.__ov[fn](...a), [fn, a]);
  const app = FRAME ? page.frameLocator(FRAME) : page;
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });

  // Screencast
  const cdp = await ctx.newCDPSession(page); const frames = []; let fi = 0;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const f = `frames/${String(fi++).padStart(6, '0')}.jpg`;
    fs.writeFile(path.join(OUT, f), Buffer.from(data, 'base64'), () => {});
    frames.push({ f, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });

  const timeline = []; const log = e => timeline.push(e);
  const meta = { title: CFG.title || 'Walkthrough', artist: CFG.artist || '', audioDir: path.join(PROJ, 'audio') };
  let beat = { t0: now(), dur: 0 };
  const L = x => (x && x.rect) ? x : x.first();
  const h = {
    loc: sel => app.locator(sel),
    wait: ms => sleep(ms),
    at: async frac => { const t = beat.t0 + beat.dur * frac; const d = (t - now()) * 1000; if (d > 0) await sleep(d); },
    async rectOf(x){
      x = L(x);
      if (x && x.rect) return x.rect();
      await x.waitFor({ state: 'visible', timeout: 15000 });
      return x.boundingBox();
    },
    async scrollIn(x, dy){ x = L(x); await x.evaluate((e, dy) => e.scrollBy({ top: dy, behavior: 'smooth' }), dy); await sleep(800); },
    async ensureVisible(x){
      x = L(x);
      if (x.rect) return;
      await x.waitFor({ state: 'visible', timeout: 15000 });
      const moved = await x.evaluate(e => {
        const r = e.getBoundingClientRect(), vh = window.innerHeight;
        const inDrawer = e.closest('[role=dialog], .drawer, .modal');
        if (r.top >= 70 && r.bottom <= vh - 40) return false;
        if (inDrawer && r.height > vh - 120 && r.top >= 0) return false;
        e.scrollIntoView({ behavior: 'smooth', block: r.height > vh * 0.6 ? 'start' : 'center' }); return true;
      });
      if (moved) await sleep(850);
    },
    async point(x, dx = 0, dy = 0){
      await h.ensureVisible(x); const r = await h.rectOf(x);
      const px = r.x + Math.min(r.width / 2, 60) + dx, py = r.y + r.height / 2 + dy;
      const t = await ov('move', px, py); await sleep(t + 120); return { px, py };
    },
    async click(x){
      x = L(x);
      const { px, py } = await h.point(x);
      await ov('click', px, py); log({ type: 'click', t: now() });
      if (x.rect) await page.mouse.click(px, py); else await x.click({ timeout: 15000 });
      await sleep(350);
    },
    async type(x, text){ x = L(x); await h.click(x); await x.pressSequentially(text, { delay: 32 }); await sleep(300); },
    async select(x, value){ x = L(x); const { px, py } = await h.point(x); await ov('click', px, py); log({ type: 'click', t: now() }); await x.selectOption(value); await sleep(600); },
    async ring(x, opts = {}){ await h.ensureVisible(x); const r = await h.rectOf(x); if (!r) return; await ov('ring', r, opts); await sleep(450); },
    unring: () => ov('unring'),
    note: (html, opts) => ov('note', html, opts || {}),
    unnote: () => ov('unnote'),
    card: async o => { await ov('card', o); await sleep(700); },
    uncard: async () => { await ov('uncard'); await sleep(650); },
    cursor: v => ov('showCursor', v),
    // A screen region to ring that isn't one element: 'viewport', 'frame' (the product iframe), 'aboveFrame' (the host
    // page's header above it), a name from config `areas`, or a literal { x, y, width, height }.
    area(name){
      return { rect: async () => {
        if (typeof name === 'object') return name;
        const f = FRAME ? await page.locator(FRAME).boundingBox() : { x: 0, y: 0, width: VW, height: VH };
        if (name === 'viewport') return { x: 6, y: 6, width: VW - 12, height: VH - 12 };
        if (name === 'frame') return { x: f.x + 8, y: f.y + 8, width: f.width - 16, height: f.height - 16 };
        if (name === 'aboveFrame') return { x: 6, y: 6, width: VW - 12, height: Math.max(20, f.y - 12) };
        if (CFG.areas && CFG.areas[name]) return CFG.areas[name]({ page, frameBox: f, VW, VH });
        throw Error('unknown area ' + name);
      } };
    },
    // Runs a slow wait (data loading) and marks it for removal in post-production, with an on-screen badge.
    async cut(fn, label){
      await ov('badge', `${label} · wait cut from the video`); await sleep(1300);
      const t0 = now(); await fn(); const t1 = now(); log({ type: 'cut', t0, t1 });
      await ov('unbadge'); await sleep(500);
    }
  };
  // Product-specific helpers (e.g. waitLoaded) live in the project's video.config.cjs.
  if (CFG.helpers) Object.assign(h, CFG.helpers(h, { app, page, sleep }));

  { const first = STEPS.find(s => !ONLY || ONLY.test(s.id)); if (first && first.introCard){ await ov('card', Object.assign({}, first.introCard, { instant: true })); await sleep(300); } }
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const tStart = now(); log({ type: 'start', t: tStart });
  let failed = null;
  try {
    for (const s of STEPS){
      if (ONLY && !ONLY.test(s.id)) continue;
      const t = now();
      if (s.pre) await s.pre(h);
      const dur = s.say ? DUR[s.id].dur : 0;
      beat = { t0: now(), dur };
      if (s.say) log({ type: 'say', id: s.id, t: beat.t0, dur });
      if (s.chapter) log({ type: 'chapter', title: s.chapter, t });
      await Promise.all([s.act ? s.act(h) : null, sleep(dur * 1000)]);
      await sleep(s.gap ?? (s.say ? 450 : 200));
      console.log('ok', s.id, (now() - tStart).toFixed(1) + 's');
      fs.writeFileSync(OUT + '/timeline.json', JSON.stringify({ meta, timeline: timeline.concat([{ type: 'end', t: now() }]), frames, errors, partial: true }));
    }
  } catch (e) { failed = e; console.error('FAILED at step:', e.message.split('\n')[0]); await page.screenshot({ path: OUT + '/failure.png' }).catch(() => {}); }
  await sleep(600);
  log({ type: 'end', t: now() });
  await cdp.send('Page.stopScreencast').catch(() => {});
  await sleep(500);
  fs.writeFileSync(OUT + '/timeline.json', JSON.stringify({ meta, timeline, frames, errors }, null, 1));
  console.log('frames', frames.length, 'errors', JSON.stringify(errors));
  await ctx.close().catch(() => {});
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
