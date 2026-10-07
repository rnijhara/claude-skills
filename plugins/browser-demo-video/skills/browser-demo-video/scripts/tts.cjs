// One WAV per narrated step, with leading and trailing silence trimmed; durations to <project>/audio/durations.json.
//   node tts.cjs <project>
// Voice comes from video.config.cjs `voice`:
//   { provider: 'polly', voiceId: 'Amy', engine: 'generative', region: 'eu-west-2', profile: '<aws profile>' }  (default; profile optional)
//   { provider: 'say', voice: 'Jamie (Premium)', rate: 168 }  (macOS, offline; spell acronyms as letters, e.g. "S A P")
// Unchanged lines are reused, so re-running after editing a few lines only regenerates those.
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const PROJ = path.resolve(process.argv[2] || '.');
const CFG = require(path.join(PROJ, 'video.config.cjs'));
const V = Object.assign({ provider: 'polly', voiceId: 'Amy', engine: 'generative', region: 'eu-west-2' }, CFG.voice || {});
const VOICE = V.provider === 'say' ? `say-${V.voice}-${V.rate || 168}` : `polly-${V.engine}-${V.voiceId}`;
const steps = require(path.join(PROJ, 'script.cjs')), dir = path.join(PROJ, 'audio'), out = {};
fs.mkdirSync(dir, { recursive: true });
const prev = fs.existsSync(dir + '/durations.json') ? JSON.parse(fs.readFileSync(dir + '/durations.json')) : {};
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse';
for (const s of steps){
  if (!s.say) continue;
  const f = path.join(dir, s.id + '.wav'), raw = path.join(dir, s.id + (V.provider === 'say' ? '.raw.wav' : '.mp3'));
  if (!(prev[s.id] && prev[s.id].text === s.say && prev[s.id].voice === VOICE && fs.existsSync(f))){
    if (V.provider === 'say')
      execFileSync('say', ['-v', V.voice, '-r', String(V.rate || 168), '--file-format=WAVE', '--data-format=LEI16@48000', '-o', raw, s.say]);
    else
      execFileSync('aws', ['polly', 'synthesize-speech', ...(V.profile ? ['--profile', V.profile] : []), '--region', V.region, '--engine', V.engine, '--voice-id', V.voiceId, '--output-format', 'mp3', '--sample-rate', '24000', '--text', s.say, raw], { stdio: 'ignore' });
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-ar', '48000', '-ac', '1', '-af', TRIM, f]);
    fs.unlinkSync(raw);
  }
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
  out[s.id] = { text: s.say, voice: VOICE, dur };
}
fs.writeFileSync(dir + '/durations.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'clips', (Object.values(out).reduce((a, x) => a + x.dur, 0) / 60).toFixed(1), 'min of narration');
