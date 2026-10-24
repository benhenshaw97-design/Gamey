// Web Audio: an evolving drone, layered chant-like voices and synthesised effects.
// Any file in /assets/audio with a matching name (.mp3 or .ogg) replaces the synth version.
import { AUDIO } from './config.js';

let ctx = null, master = null, busDrone, busChant, busFx, reverbIn;
let volume = AUDIO.defaultVolume, muted = false, stage = 0, chantLevel = .5;
const buffers = {};
const drone = { oscs: [], gains: [], filter: null, src: null };
let chantTimer = null, chantSrc = null;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const now = () => ctx.currentTime;

export const audioStarted = () => !!ctx;
// names of the sounds that were replaced by your own files
export const loadedFiles = () => Object.keys(buffers);

// Must be called from a user gesture (the first tap).
export function startAudio(settings) {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  if (settings) { if (settings.volume != null) volume = settings.volume; muted = !!settings.muted; }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(comp).connect(ctx.destination);
  // a dark feedback delay standing in for a crypt's reverb
  reverbIn = ctx.createGain(); reverbIn.gain.value = .35;
  const delay = ctx.createDelay(1); delay.delayTime.value = .31;
  const fb = ctx.createGain(); fb.gain.value = .42;
  const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1400;
  reverbIn.connect(delay).connect(damp).connect(fb).connect(delay);
  damp.connect(master);
  busDrone = bus(AUDIO.drone.gain, .2);
  busChant = bus(AUDIO.chant.gain, .7);
  busFx = bus(.9, .3);
  loadFiles().then(() => { startDrone(); startChant(); });
}
function bus(gain, wet) {
  const g = ctx.createGain(); g.gain.value = gain;
  g.connect(master);
  const s = ctx.createGain(); s.gain.value = wet;
  g.connect(s).connect(reverbIn);
  return g;
}

/* ---------- optional files ---------- */
async function loadOne(name) {
  for (const ext of AUDIO.extensions) {
    try {
      const res = await fetch(`${AUDIO.folder}${name}.${ext}`);
      if (!res.ok) continue;
      buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
      return;
    } catch (e) { /* missing or undecodable: keep the synth version */ }
  }
}
function loadFiles() {
  const names = [AUDIO.drone.file, AUDIO.chant.file, ...AUDIO.effects];
  return Promise.all(names.map(loadOne));
}
function playBuffer(name, gain = 1, rate = 1) {
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buffers[name]; s.playbackRate.value = rate; g.gain.value = gain;
  s.connect(g).connect(busFx);
  s.start();
}

/* ---------- settings ---------- */
export function setVolume(v) { volume = v; if (master) master.gain.setTargetAtTime(muted ? 0 : v, now(), .05); }
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : volume, now(), .05); }

/* ---------- drone ---------- */
const root = () => AUDIO.drone.stageRoots[Math.min(stage, AUDIO.drone.stageRoots.length - 1)];
// [ratio to the root, waveform, gain, stage at which this layer fades in]
const DRONE_LAYERS = [[1, 'sawtooth', .5, 0], [1.006, 'sawtooth', .4, 0], [.5, 'sine', .8, 0], [1.5, 'triangle', .22, 1], [1.189, 'triangle', .2, 2], [2.01, 'sawtooth', .12, 3]];
function startDrone() {
  if (buffers[AUDIO.drone.file]) {
    const s = drone.src = ctx.createBufferSource();
    s.buffer = buffers[AUDIO.drone.file]; s.loop = true;
    s.playbackRate.value = root() / AUDIO.drone.stageRoots[0];
    s.connect(busDrone); s.start();
    return;
  }
  const f = drone.filter = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 6;
  // slow LFOs make the drone breathe
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  lfo.frequency.value = .06; lfoG.gain.value = 140;
  lfo.connect(lfoG).connect(f.frequency); lfo.start();
  const swell = ctx.createGain(); swell.gain.value = .8;
  const lfo2 = ctx.createOscillator(), lfo2G = ctx.createGain();
  lfo2.frequency.value = .023; lfo2G.gain.value = .25;
  lfo2.connect(lfo2G).connect(swell.gain); lfo2.start();
  f.connect(swell).connect(busDrone);
  DRONE_LAYERS.forEach(([ratio, type, gain, from]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = root() * ratio;
    g.gain.value = stage >= from ? gain : 0;
    o.connect(g).connect(f); o.start();
    drone.oscs.push(o); drone.gains.push(g);
  });
  ctx.resume();
}
export function setStage(s) {
  stage = s;
  if (!ctx) return;
  const t = now();
  if (drone.src) drone.src.playbackRate.setTargetAtTime(root() / AUDIO.drone.stageRoots[0], t, 2);
  drone.oscs.forEach((o, i) => {
    o.frequency.setTargetAtTime(root() * DRONE_LAYERS[i][0], t, 2.5);
    drone.gains[i].gain.setTargetAtTime(stage >= DRONE_LAYERS[i][3] ? DRONE_LAYERS[i][2] : 0, t, 3);
  });
  if (drone.filter) drone.filter.frequency.setTargetAtTime(240 + stage * 70, t, 3);
}

/* ---------- chant ---------- */
// rough vowel formants: [F1, F2]
const VOWELS = [[730, 1090], [570, 840], [300, 870], [440, 1020], [270, 2290]];
function voice(freq, start, dur, gain) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = freq;
  const vib = ctx.createOscillator(), vibG = ctx.createGain();
  vib.frequency.value = rand(4.5, 5.5); vibG.gain.value = freq * .006;
  vib.connect(vibG).connect(o.frequency);
  const [f1, f2] = pick(VOWELS);
  const out = ctx.createGain(); out.gain.value = 0;
  [[f1, 1], [f2, .5]].forEach(([fq, amp]) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 9;
    const a = ctx.createGain(); a.gain.value = amp * 3;
    o.connect(bp).connect(a).connect(out);
  });
  out.connect(g).connect(busChant);
  g.gain.value = gain;
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(1, start + dur * .35);
  out.gain.setValueAtTime(1, start + dur * .6);
  out.gain.linearRampToValueAtTime(0, start + dur);
  o.start(start); vib.start(start);
  o.stop(start + dur + .1); vib.stop(start + dur + .1);
}
function chantPhrase() {
  if (!ctx) return;
  const base = root() * 4, sc = AUDIO.chant.scale;
  const deg = pick(sc), t = now() + .05, dur = rand(3.5, 6);
  const n = 1 + Math.round(chantLevel * 2);
  voice(base * Math.pow(2, deg / 12), t, dur, .5 * chantLevel + .1);
  if (n > 1) voice(base * Math.pow(2, (deg + 7) / 12) * .5, t + .2, dur, .35 * chantLevel);
  if (n > 2) voice(base * Math.pow(2, pick(sc) / 12), t + .5, dur * .8, .25 * chantLevel);
  const [a, b] = AUDIO.chant.everySeconds;
  chantTimer = setTimeout(chantPhrase, rand(a, b) * 1000);
}
function startChant() {
  if (buffers[AUDIO.chant.file]) {
    chantSrc = ctx.createBufferSource(); chantSrc.buffer = buffers[AUDIO.chant.file]; chantSrc.loop = true;
    chantSrc.gainNode = ctx.createGain(); chantSrc.gainNode.gain.value = chantLevel;
    chantSrc.connect(chantSrc.gainNode).connect(busChant); chantSrc.start();
    return;
  }
  chantPhrase();
}
// 0..1: how loud the chanting is (more cultists, more voices)
export function setChantLevel(l) {
  chantLevel = Math.max(0, Math.min(1, l));
  if (chantSrc) chantSrc.gainNode.gain.setTargetAtTime(chantLevel, now(), 1);
}

/* ---------- effects ---------- */
function noise(dur) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b;
  return s;
}
function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, type, t, a, peak, d, slideTo) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + a + d);
  env(g, t, a, peak, d);
  o.connect(g).connect(busFx);
  o.start(t); o.stop(t + a + d + .05);
  return o;
}
function filteredNoise(t, dur, type, f0, f1, peak) {
  const n = noise(dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = 2;
  env(g, t, .02, peak, dur);
  n.connect(f).connect(g).connect(busFx);
  n.start(t);
}
const SYNTH = {
  sacrifice(t) {
    filteredNoise(t, .5, 'lowpass', 1200, 200, .7);
    tone(110, 'sawtooth', t, .02, .35, .9, 38);
    for (let i = 0; i < 4; i++) filteredNoise(t + .15 + i * .09, .08, 'bandpass', 900, 300, .4);
  },
  slain(t) { tone(80, 'sine', t, .005, .6, .4, 40); filteredNoise(t, .25, 'lowpass', 800, 100, .4); },
  recruit(t) { [1, 2.76, 5.4].forEach((p, i) => { tone(392 * p, 'sine', t, .01, .18 / (i + 1), 1.6); tone(523 * p, 'sine', t + .22, .01, .15 / (i + 1), 1.8); }); },
  leave(t) { tone(330, 'triangle', t, .05, .15, 1, 180); },
  growth(t) {
    [0, 7, 12].forEach((s, i) => tone(55 * Math.pow(2, s / 12), 'sawtooth', t + i * .05, 1.2, .22, 1.6, 110 * Math.pow(2, s / 12)));
    tone(48, 'sine', t + 1.2, .01, .9, 1.8, 30);
    filteredNoise(t, 2.4, 'bandpass', 200, 3000, .25);
  },
  death(t) {
    [0, 3, 7, 10].forEach((s, i) => tone(220 * Math.pow(2, s / 12), 'sawtooth', t + i * .12, .3, .12, 3.5, 55 * Math.pow(2, s / 12)));
    tone(40, 'sine', t, .2, .8, 4);
  },
  swipe(t) { filteredNoise(t, .28, 'bandpass', 400, 2400, .22); },
  attach(t) { filteredNoise(t, .35, 'bandpass', 1800, 160, .6); tone(140, 'sine', t + .05, .01, .4, .25, 60); },
  tap(t) { tone(900, 'triangle', t, .002, .05, .06); },
};
export function sfx(name) {
  if (!ctx || muted) return;
  if (buffers[name]) return playBuffer(name);
  if (SYNTH[name]) SYNTH[name](now() + .01);
}
// growth and death also nudge the drone
export function swellDrone(amount = 1) {
  if (!ctx || !drone.filter) return;
  const t = now(), f = drone.filter.frequency;
  f.cancelScheduledValues(t);
  f.setValueAtTime(f.value, t);
  f.linearRampToValueAtTime(800 * amount, t + 1.2);
  f.setTargetAtTime(240 + stage * 70, t + 1.4, 2);
}
