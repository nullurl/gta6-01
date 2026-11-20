// Procedural sound: everything is synthesized with WebAudio, no audio files.
// Engine hum, police siren, gunshots, pickups, jingles and a light bass groove.

let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let musicTimer = null;
let musicStep = 0;

const BASS_LINE = [55, 0, 55, 65.4, 0, 55, 0, 49, 55, 0, 55, 65.4, 73.4, 0, 65.4, 49];

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    startEngineLoop();
    startSirenLoop();
    startMusic();
  } catch {
    ctx = null;
  }
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function startEngineLoop() {
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(filter);
  filter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
}

function startSirenLoop() {
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenOsc.frequency.value = 700;
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain);
  sirenGain.connect(master);
  sirenOsc.start();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.9;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 260;
  lfo.connect(lfoGain);
  lfoGain.connect(sirenOsc.frequency);
  lfo.start();
}

// Called every frame: engine pitch follows speed, siren follows the nearest cop.
export function updateAudio(driving, speedKmh, nearestCopDist) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const target = driving ? 0.05 + Math.min(0.09, speedKmh / 2400) : 0;
  engineGain.gain.setTargetAtTime(target, now, 0.1);
  engineOsc.frequency.setTargetAtTime(50 + speedKmh * 0.9, now, 0.1);
  const siren = nearestCopDist < 700 ? 0.035 * (1 - nearestCopDist / 700) + 0.012 : 0;
  sirenGain.gain.setTargetAtTime(siren, now, 0.3);
}

function blip(freq, dur, type, vol, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, cutoff) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start();
}

export function playShoot() {
  noiseBurst(0.12, 0.25, 1800);
  blip(160, 0.08, 'square', 0.1);
}

export function playPickup() {
  blip(660, 0.09, 'sine', 0.16);
  blip(990, 0.14, 'sine', 0.16, 0.08);
}

export function playCrash() {
  noiseBurst(0.18, 0.3, 700);
}

export function playMissionComplete() {
  [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, 'triangle', 0.18, i * 0.11));
}

export function playBusted() {
  [392, 330, 262].forEach((f, i) => blip(f, 0.3, 'triangle', 0.16, i * 0.18));
}

export function playSirenBlip() {
  blip(880, 0.12, 'square', 0.08);
  blip(660, 0.12, 'square', 0.08, 0.12);
}

function startMusic() {
  musicTimer = window.setInterval(() => {
    if (!ctx || muted) return;
    const note = BASS_LINE[musicStep % BASS_LINE.length];
    if (note > 0) blip(note, 0.22, 'sine', 0.1);
    if (musicStep % 4 === 2) blip(1200, 0.03, 'square', 0.02);
    musicStep += 1;
  }, 240);
}
