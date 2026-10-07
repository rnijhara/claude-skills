// Per-video settings, read by record.cjs, tts.cjs and post.py (via the take's timeline).
module.exports = {
  title: '<App name>: internal walkthrough',        // MP4 title metadata
  artist: '<Product or team>',
  // A disposable environment, copy or test workspace: recording clicks real buttons and writes real data.
  url: 'https://<product>/<page>',
  // Optional: a local build of the app with a mocked bridge, for full dry runs before touching production.
  previewUrl: null,
  previewInit: null,                                 // optional function run in the page before load (preview only)
  frame: null,                                       // selector of the iframe the product runs in, if it is embedded
  previewFrame: null,
  ready: null,                                       // selector that proves the page loaded and the user is signed in
  emulateFullscreen: false,                          // true if setup clicks the product's own full-screen button
  // Framing before recording starts: hide side panels, dismiss banners, enter full screen, assert the layout.
  setup: async ({ page, frame, sleep, VW, VH }) => {},
  areas: {},                                         // named regions for h.area(name): ({ page, frameBox, VW, VH }) => rect
  viewport: { width: 1440, height: 810 },            // 16:9 that fits inside the display; frames are captured at 2x
  locale: 'en-GB', timezone: 'Europe/London',
  theme: { accent: '#00a8b6', ink: '#172121', foot: '<Product> · <Team>', kicker: '#7fdbe3', cardBg: '#121c1c' },  // accent as #rrggbb
  // Amazon Polly generative Amy (en-GB) was the accepted voice. For offline: { provider: 'say', voice: 'Jamie (Premium)' }.
  voice: { provider: 'polly', voiceId: 'Amy', engine: 'generative', profile: '<aws-profile>', region: 'eu-west-2' },  // use a dev/non-prod AWS account
  // App-specific helpers merged into `h`. `waitLoaded` is what h.cut() usually wraps.
  helpers: (h, { app, sleep }) => ({
    async waitLoaded(){
      // Wait for the product's own "loaded" signal; replace with its selector.
      await app.locator('<loaded-indicator>').waitFor({ timeout: 150000 });
      await sleep(1500);
    },
  }),
};
