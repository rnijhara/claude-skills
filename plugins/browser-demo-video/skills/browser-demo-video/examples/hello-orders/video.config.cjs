// Runnable example: a tiny product embedded in an iframe under a host header.
//   (cd site && python3 -m http.server 8799) &
//   node ../../scripts/tts.cjs . && node ../../scripts/record.cjs . record && python3 ../../scripts/post.py takes/prod takes/prod/out.mp4
module.exports = {
  title: 'Hello orders', artist: 'Example', url: 'http://127.0.0.1:8799/index.html', frame: 'iframe[title="Product"]',
  viewport: { width: 1440, height: 810 }, theme: { accent: '#3b5bdb', foot: 'Hello orders · Example' },
  voice: { provider: 'say', voice: 'Daniel' },   // offline; switch to Polly for a natural voice
  helpers: (h, { app, sleep }) => ({ async waitLoaded(){ await app.locator('#status').filter({ hasText: 'Loaded' }).waitFor({ timeout: 20000 }); await sleep(300); } }),
};
