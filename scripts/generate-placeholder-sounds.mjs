/**
 * Generates PLACEHOLDER sounds by pure synthesis (no download, no dependency),
 * so the board works out of the box. Replace them with real recordings in
 * public/sounds/ whenever you like, and keep or update library.json.
 *
 * Usage: npm run sounds:placeholders
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 22050;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sounds');

// ---------------------------------------------------------------------------
// Basic tools
// ---------------------------------------------------------------------------

let seed = 7;
/** Seeded random in [0, 1): same files on every run. */
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rand() * 2 - 1;
const between = (a, b) => a + rand() * (b - a);
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const buffer = (seconds) => new Float32Array(Math.round(seconds * SR));
const TAU = Math.PI * 2;

function lowpass(cutoff) {
  let y = 0;
  const a = 1 - Math.exp((-TAU * cutoff) / SR);
  return (x) => (y += a * (x - y));
}

function highpass(cutoff) {
  const lp = lowpass(cutoff);
  return (x) => x - lp(x);
}

/** RBJ biquad whose frequency can change while running. */
function biquad(type, q) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  let lastFreq = -1;
  return (x, freq) => {
    if (Math.abs(freq - lastFreq) > 0.5) {
      lastFreq = freq;
      const w0 = (TAU * freq) / SR;
      const cos = Math.cos(w0);
      const alpha = Math.sin(w0) / (2 * q);
      const a0 = 1 + alpha;
      if (type === 'lowpass') {
        b0 = (1 - cos) / 2 / a0; b1 = (1 - cos) / a0; b2 = b0;
      } else {
        b0 = alpha / a0; b1 = 0; b2 = -alpha / a0;
      }
      a1 = (-2 * cos) / a0;
      a2 = (1 - alpha) / a0;
    }
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function mixInto(target, source, atSeconds, gain = 1) {
  const offset = Math.round(atSeconds * SR);
  for (let i = 0; i < source.length && offset + i < target.length; i++) {
    if (offset + i >= 0) target[offset + i] += source[i] * gain;
  }
}

/** Folds what rings past the loop end back onto the start (for musical loops). */
function foldTail(b, loopSeconds) {
  const n = Math.round(loopSeconds * SR);
  const out = b.slice(0, n);
  for (let i = n; i < b.length; i++) out[(i - n) % n] += b[i];
  return out;
}

/** Seamless loop for noisy textures: crossfades the extra end into the start. */
function crossfadeLoop(b, loopSeconds, fadeSeconds) {
  const n = Math.round(loopSeconds * SR);
  const f = Math.round(fadeSeconds * SR);
  const out = b.slice(0, n);
  for (let i = 0; i < f; i++) {
    const t = i / f;
    out[i] = b[i] * Math.sqrt(t) + b[n + i] * Math.sqrt(1 - t);
  }
  return out;
}

function fadeOutEnd(b, seconds) {
  const f = Math.min(b.length, Math.round(seconds * SR));
  for (let i = 0; i < f; i++) b[b.length - 1 - i] *= i / f;
  return b;
}

function normalize(b, peak = 0.89) {
  let max = 0;
  for (const v of b) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / max;
  return b;
}

function writeWav(relativePath, samples) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + samples.length * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  const path = join(OUT_DIR, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`  ${relativePath}  (${(samples.length / SR).toFixed(1)} s)`);
}

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

/** Karplus-Strong plucked string: a cheap lute. */
function pluck(freq, seconds, damping = 0.995) {
  const out = buffer(seconds);
  const period = Math.max(2, Math.round(SR / freq));
  const ring = new Float32Array(period);
  const warm = lowpass(3000);
  for (let i = 0; i < period; i++) ring[i] = warm(noise());
  let index = 0;
  for (let i = 0; i < out.length; i++) {
    const current = ring[index];
    const next = ring[(index + 1) % period];
    out[i] = current;
    ring[index] = damping * 0.5 * (current + next);
    index = (index + 1) % period;
  }
  return out;
}

/** Inharmonic partials with exponential decays: bells, blades, glasses. */
function metal(freq, seconds, ratios, decays, gains = ratios.map(() => 1)) {
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    ratios.forEach((r, k) => (v += gains[k] * Math.sin(TAU * freq * r * t) * Math.exp(-t / decays[k])));
    out[i] = v;
  }
  return out;
}

function drumHit(freq, seconds, decay) {
  const out = buffer(seconds);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    phase += (TAU * freq * (1 + 0.6 * Math.exp(-t / 0.02))) / SR;
    out[i] = Math.sin(phase) * Math.exp(-t / decay);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Musiques
// ---------------------------------------------------------------------------

function troubadours() {
  const loop = 8;
  const out = buffer(loop + 3);
  const eighth = 0.25;
  const chords = [
    { bass: 48, arp: [60, 64, 67, 72] }, // C
    { bass: 45, arp: [57, 60, 64, 69] }, // Am
    { bass: 41, arp: [57, 60, 65, 69] }, // F
    { bass: 43, arp: [55, 59, 62, 67] }, // G
  ];
  const pattern = [0, 1, 2, 3, 2, 1, 2, 1];
  chords.forEach((chord, c) => {
    pattern.forEach((p, step) => {
      const at = c * 2 + step * eighth;
      mixInto(out, pluck(midi(chord.arp[p]), 1.5), at, step === 0 ? 0.9 : 0.6);
    });
    mixInto(out, pluck(midi(chord.bass), 2.5, 0.997), c * 2, 0.9);
    mixInto(out, pluck(midi(chord.bass + 7), 2, 0.997), c * 2 + 1, 0.5);
    for (let beat = 0; beat < 4; beat++) {
      mixInto(out, drumHit(85, 0.4, 0.12), c * 2 + beat * 0.5, beat % 2 === 0 ? 0.7 : 0.35);
    }
  });
  return normalize(foldTail(out, loop));
}

function inquietant() {
  const loop = 12;
  // Render two cycles and keep the second: the filter is "warm" at the seam.
  const twoCycles = buffer(loop * 2);
  const filter = lowpass(380);
  for (let i = 0; i < twoCycles.length; i++) {
    const t = i / SR;
    // Frequencies chosen so that f * 12 s is an integer: the loop is seamless.
    const saw = (f) => 2 * ((f * t) % 1) - 1;
    const swell = 0.65 + 0.35 * Math.sin((TAU * t) / 6);
    twoCycles[i] = filter(saw(73.5) + 0.6 * saw(110) + 0.3 * saw(55.25)) * swell;
  }
  const drone = twoCycles.slice(Math.round(loop * SR));
  const bells = buffer(loop + 4);
  [
    [1.5, 74], [4.5, 75], [7.5, 74], [10.2, 73],
  ].forEach(([at, note]) => mixInto(bells, metal(midi(note), 4, [1, 2.76, 5.4], [2.2, 1.1, 0.5], [1, 0.5, 0.25]), at, 0.35));
  const folded = foldTail(bells, loop);
  for (let i = 0; i < drone.length; i++) drone[i] = drone[i] * 0.6 + folded[i];
  return normalize(drone, 0.8);
}

// ---------------------------------------------------------------------------
// Ambiances (seamless loops)
// ---------------------------------------------------------------------------

function taverne() {
  const loop = 12, fade = 1.5;
  const out = buffer(loop + fade);
  // Crowd: several "voices" of band-limited noise with syllable-like bursts.
  for (let v = 0; v < 7; v++) {
    const hp = highpass(between(200, 350));
    const lp = lowpass(between(800, 1300));
    const smooth = lowpass(12);
    let target = 0, nextChange = 0;
    for (let i = 0; i < out.length; i++) {
      if (i >= nextChange) {
        target = rand() < 0.3 ? 0 : between(0.3, 1);
        nextChange = i + Math.round(between(0.12, 0.3) * SR);
      }
      out[i] += lp(hp(noise())) * smooth(target) * 0.5;
    }
  }
  const room = lowpass(150);
  for (let i = 0; i < out.length; i++) out[i] += room(noise()) * 0.6;
  // Glasses and tankards clinking now and then.
  for (let at = 0.6; at < loop - 0.5; at += between(0.9, 2.2)) {
    const f = between(2200, 3200);
    mixInto(out, metal(f, 0.5, [1, 1.47, 2.1], [0.18, 0.1, 0.06]), at, between(0.04, 0.09));
  }
  return normalize(crossfadeLoop(out, loop, fade), 0.8);
}

function cheminee() {
  const loop = 10, fade = 1.5;
  const out = buffer(loop + fade);
  const rumble = lowpass(180);
  for (let i = 0; i < out.length; i++) out[i] = rumble(noise()) * 1.2;
  const crackleFilter = highpass(1500);
  for (let i = 0; i < out.length; i++) {
    if (rand() < 14 / SR) {
      const big = rand() < 0.12;
      const length = Math.round(between(0.002, big ? 0.02 : 0.008) * SR);
      const gain = big ? between(0.5, 0.9) : between(0.08, 0.3);
      for (let k = 0; k < length && i + k < out.length; k++) {
        out[i + k] += crackleFilter(noise()) * gain * (1 - k / length);
      }
    }
  }
  return normalize(crossfadeLoop(out, loop, fade), 0.8);
}

function goutteAGoutte() {
  const loop = 10, fade = 1;
  const out = buffer(loop + fade);
  const hum = lowpass(110);
  for (let i = 0; i < out.length; i++) out[i] = hum(noise()) * 0.25;
  const drop = (f) => {
    const b = buffer(0.15);
    let phase = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      phase += (TAU * f * (1 + 1.2 * Math.min(1, t / 0.03))) / SR;
      b[i] = Math.sin(phase) * Math.exp(-t / 0.035);
    }
    return b;
  };
  for (let at = 0.4; at < loop - 0.6; at += between(0.6, 1.9)) {
    const d = drop(between(700, 1100));
    const g = between(0.5, 1);
    mixInto(out, d, at, g);
    mixInto(out, d, at + 0.13, g * 0.3); // cave echoes
    mixInto(out, d, at + 0.27, g * 0.12);
  }
  return normalize(crossfadeLoop(out, loop, fade), 0.75);
}

function ventSouterrain() {
  const loop = 12, fade = 2;
  const out = buffer(loop + fade);
  const body = biquad('lowpass', 0.8);
  const whistle = biquad('bandpass', 9);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const gust = 0.5 + 0.5 * Math.sin((TAU * t) / 6 + 1.3 * Math.sin((TAU * t) / 4));
    const n = noise();
    out[i] = body(n, 250 + 600 * gust) * (0.4 + 0.6 * gust) + whistle(n, 520 + 260 * gust) * 0.5 * gust;
  }
  return normalize(crossfadeLoop(out, loop, fade), 0.8);
}

// ---------------------------------------------------------------------------
// Bruitages (one-shots, several variants)
// ---------------------------------------------------------------------------

function chope(pitch) {
  const out = buffer(0.6);
  mixInto(out, drumHit(105 * pitch, 0.4, 0.07), 0, 1);
  mixInto(out, metal(430 * pitch, 0.2, [1, 2.3], [0.04, 0.02]), 0, 0.5);
  const thump = lowpass(900);
  for (let i = 0; i < 0.05 * SR; i++) out[i] += thump(noise()) * (1 - i / (0.05 * SR)) * 0.8;
  // A little slosh of beer.
  const slosh = biquad('bandpass', 2);
  for (let i = Math.round(0.03 * SR); i < out.length; i++) {
    const t = i / SR - 0.03;
    out[i] += slosh(noise(), 700 + 300 * Math.sin(TAU * 9 * t)) * Math.exp(-t / 0.12) * 0.25;
  }
  return normalize(fadeOutEnd(out, 0.05));
}

function epee(pitch) {
  const out = buffer(1.8);
  const swoosh = biquad('bandpass', 1.5);
  const swooshLength = 0.24;
  for (let i = 0; i < swooshLength * SR; i++) {
    const p = i / (swooshLength * SR);
    out[i] += swoosh(noise(), 500 + 3000 * p) * Math.sin(Math.PI * p) * 0.9;
  }
  const hit = metal(880 * pitch, 1.6, [1, 2.76, 5.4, 8.93], [1.1, 0.7, 0.4, 0.2], [1, 0.6, 0.35, 0.2]);
  const transient = highpass(2000);
  for (let i = 0; i < 0.015 * SR; i++) hit[i] += transient(noise()) * (1 - i / (0.015 * SR)) * 1.5;
  mixInto(out, hit, 0.2, 0.7);
  return normalize(fadeOutEnd(out, 0.1));
}

function squelette(clicks) {
  const out = buffer(1);
  let at = 0.02;
  for (let c = 0; c < clicks; c++) {
    const bone = metal(between(1300, 2200), 0.05, [1, 1.9], [0.012, 0.006]);
    const crack = highpass(2500);
    for (let i = 0; i < 0.008 * SR; i++) bone[i] += crack(noise()) * (1 - i / (0.008 * SR));
    mixInto(out, bone, at, between(0.4, 1));
    at += between(0.04, 0.1);
  }
  return normalize(fadeOutEnd(out, 0.05));
}

function porte() {
  const seconds = 1.9;
  const out = buffer(seconds);
  const resA = biquad('bandpass', 7);
  const resB = biquad('bandpass', 5);
  const wobble = lowpass(3);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const rate = 35 + 70 * Math.max(0, wobble(rand())) + 25 * Math.sin(TAU * 0.7 * t);
    phase += rate / SR;
    let impulse = 0;
    if (phase >= 1) {
      phase -= 1;
      impulse = 1;
    }
    const env = Math.sin((Math.PI * t) / seconds) ** 0.6;
    out[i] = (resA(impulse, 620) + 0.6 * resB(impulse, 1450)) * env;
  }
  return normalize(fadeOutEnd(out, 0.1));
}

// ---------------------------------------------------------------------------
// Sons (comic stingers)
// ---------------------------------------------------------------------------

function tromboneTriste() {
  const notes = [[55, 0.42], [54, 0.42], [53, 0.42], [52, 1.5]];
  const total = notes.reduce((s, [, d]) => s + d, 0) + 0.2;
  const out = buffer(total);
  const filter = biquad('lowpass', 3);
  let phase = 0, offset = 0;
  notes.forEach(([note, duration], n) => {
    const last = n === notes.length - 1;
    for (let i = 0; i < duration * SR; i++) {
      const t = i / SR;
      const vibrato = last ? 1 + 0.018 * Math.sin(TAU * 5.5 * t) * Math.min(1, t / 0.3) : 1;
      phase += (midi(note) * vibrato) / SR;
      const saw = 2 * (phase % 1) - 1;
      const wah = 350 + 1500 * Math.sin(Math.PI * Math.min(1, t / Math.min(duration, 0.45)));
      const env = Math.min(1, t / 0.03) * (last ? Math.exp(-t / 1.2) : Math.min(1, (duration - t) / 0.05));
      out[offset + i] = filter(saw, wah) * env;
    }
    offset += Math.round(duration * SR);
  });
  return normalize(fadeOutEnd(out, 0.15));
}

function niveauGagne() {
  const out = buffer(1.6);
  const pulse = (freq, seconds, decay) => {
    const b = buffer(seconds);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] = ((freq * t) % 1 < 0.25 ? 1 : -1) * Math.exp(-t / decay) * Math.min(1, t / 0.005);
    }
    return b;
  };
  [72, 76, 79, 84].forEach((note, k) => mixInto(out, pulse(midi(note), 0.2, 0.12), k * 0.09, 0.35));
  [84, 88, 91].forEach((note) => mixInto(out, pulse(midi(note), 1.2, 0.45), 0.38, 0.22));
  [96, 100, 103, 108].forEach((note, k) => mixInto(out, metal(midi(note), 0.5, [1], [0.15]), 0.4 + k * 0.07, 0.15));
  const soften = lowpass(5000);
  for (let i = 0; i < out.length; i++) out[i] = soften(out[i]);
  return normalize(fadeOutEnd(out, 0.1));
}

// ---------------------------------------------------------------------------

console.log(`Génération des sons provisoires dans ${OUT_DIR}`);
writeWav('musiques/troubadours.wav', troubadours());
writeWav('musiques/donjon-inquietant.wav', inquietant());
writeWav('ambiances/taverne.wav', taverne());
writeWav('ambiances/cheminee.wav', cheminee());
writeWav('ambiances/goutte-a-goutte.wav', goutteAGoutte());
writeWav('ambiances/vent-souterrain.wav', ventSouterrain());
writeWav('bruitages/chope-1.wav', chope(1));
writeWav('bruitages/chope-2.wav', chope(0.86));
writeWav('bruitages/epee-1.wav', epee(1));
writeWav('bruitages/epee-2.wav', epee(1.12));
writeWav('bruitages/epee-3.wav', epee(0.87));
writeWav('bruitages/squelette-1.wav', squelette(7));
writeWav('bruitages/squelette-2.wav', squelette(10));
writeWav('bruitages/porte-grince.wav', porte());
writeWav('sons/trombone-triste.wav', tromboneTriste());
writeWav('sons/niveau-gagne.wav', niveauGagne());
console.log('Terminé.');
