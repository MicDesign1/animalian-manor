/**
 * sounds.js — Battle sound effects for Animalian Manor
 *
 * All sounds are generated in code using the Web Audio API.
 * No audio files needed — everything is synthesized from scratch!
 *
 * Each creature type gets its own distinct sound character:
 *   Ember   🔥 — fiery sawtooth growl
 *   Tide    🌊 — filtered water splash noise
 *   Thorn   🌿 — earthy triangle thud
 *   Storm   ⚡ — electric square-wave zap
 *   Phantom 🌙 — eerie sine-wave float
 *   Iron    ⚙️ — metallic clang with harmonics
 */

// One shared AudioContext for the whole game (browsers limit how many you can make)
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  // Browsers sometimes suspend audio until the user interacts — resume it
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── Helper: a short buffer of white noise ─────────────────────────────────────
function noiseSource(c) {
  const len    = Math.floor(c.sampleRate * 0.6); // 0.6s of noise
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  return src;
}

// ── Type attack sounds ────────────────────────────────────────────────────────

// 🔥 Ember — a sawtooth growl that rumbles downward like a burst of flame
function playEmber() {
  const c    = getCtx();
  const t    = c.currentTime;
  const osc  = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(35, t + 0.38);

  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.42);
}

// 🌊 Tide — bandpass-filtered noise that rises and falls like a wave crashing
function playTide() {
  const c      = getCtx();
  const t      = c.currentTime;
  const noise  = noiseSource(c);
  const filter = c.createBiquadFilter();
  const gain   = c.createGain();

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1400, t);
  filter.frequency.exponentialRampToValueAtTime(350, t + 0.5);
  filter.Q.value = 1.2;

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.55, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  noise.start(t);
  noise.stop(t + 0.5);
}

// 🌿 Thorn — a triangle wave thud that drops fast — organic and earthy
function playThorn() {
  const c    = getCtx();
  const t    = c.currentTime;
  const osc  = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);

  gain.gain.setValueAtTime(0.55, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

// ⚡ Storm — a square wave that arcs up like a lightning bolt, then snaps off
function playStorm() {
  const c    = getCtx();
  const t    = c.currentTime;
  const osc  = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(1400, t + 0.05);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.22);

  gain.gain.setValueAtTime(0.22, t);
  gain.gain.setValueAtTime(0.22, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.24);
}

// 🌙 Phantom — an eerie sine wave that drifts upward, then fades into silence
function playPhantom() {
  const c    = getCtx();
  const t    = c.currentTime;
  const osc  = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, t);
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.2);
  osc.frequency.exponentialRampToValueAtTime(160, t + 0.65);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.28, t + 0.07);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.65);
}

// ⚙️ Iron — a metallic clang built from four square-wave harmonics
function playIron() {
  const c = getCtx();
  const t = c.currentTime;
  // Stack harmonics for a bell-like metallic ring
  [220, 349, 440, 698].forEach(freq => {
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

// ── Outcome sounds ────────────────────────────────────────────────────────────

// 👏 Applause — many overlapping noise bursts simulating a crowd clapping
export function playApplause() {
  try {
    const c = getCtx();
    // One short buffer reused across all clap nodes
    const bufLen = Math.floor(c.sampleRate * 0.12);
    const buffer = c.createBuffer(1, bufLen, c.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    for (let i = 0; i < 24; i++) {
      const delay  = Math.max(0, i * 0.1 + Math.random() * 0.06 - 0.02);
      const t      = c.currentTime + delay;
      const src    = c.createBufferSource();
      src.buffer   = buffer;
      const filter = c.createBiquadFilter();
      const gain   = c.createGain();
      filter.type          = 'bandpass';
      filter.frequency.value = 1500 + Math.random() * 1200;
      filter.Q.value       = 0.7 + Math.random() * 0.6;
      const vol = 0.1 + Math.random() * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      src.start(t);
      src.stop(t + 0.12);
    }
  } catch (_) { /* audio is optional */ }
}

// 😮 Gasp — sharp crowd inhale followed by a low murmur
export function playGasp() {
  try {
    const c = getCtx();
    const t = c.currentTime;

    // Sharp inhale: bandpass noise that rises then falls
    const inhale = noiseSource(c);
    const filter = c.createBiquadFilter();
    const gain   = c.createGain();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400,  t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + 0.09);
    filter.frequency.exponentialRampToValueAtTime(650,  t + 0.3);
    filter.Q.value = 1.6;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.48, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    inhale.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    inhale.start(t);
    inhale.stop(t + 0.35);

    // Post-gasp murmur bursts
    const bufLen = Math.floor(c.sampleRate * 0.12);
    const buf    = c.createBuffer(1, bufLen, c.sampleRate);
    const bd     = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) bd[i] = Math.random() * 2 - 1;
    for (let i = 0; i < 6; i++) {
      const nt  = c.currentTime + 0.38 + i * 0.11 + Math.random() * 0.06;
      const src = c.createBufferSource();
      src.buffer = buf;
      const f2  = c.createBiquadFilter();
      const g2  = c.createGain();
      f2.type   = 'bandpass';
      f2.frequency.value = 500 + Math.random() * 400;
      f2.Q.value = 1.0;
      g2.gain.setValueAtTime(0.06 + Math.random() * 0.03, nt);
      g2.gain.exponentialRampToValueAtTime(0.0001, nt + 0.12);
      src.connect(f2);
      f2.connect(g2);
      g2.connect(c.destination);
      src.start(nt);
      src.stop(nt + 0.13);
    }
  } catch (_) { /* audio is optional */ }
}

// 🏆 Victory — a bright ascending major arpeggio (C E G C)
export function playVictory() {
  try {
    const c = getCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      const t    = c.currentTime + i * 0.12;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch (_) { /* audio is optional */ }
}

// 💫 Defeat — a drooping descending minor phrase
export function playDefeat() {
  try {
    const c = getCtx();
    [392, 349, 294, 220].forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      const t    = c.currentTime + i * 0.16;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch (_) { /* audio is optional */ }
}

// ✨ Created — a bright rising sparkle arpeggio for the creature creation moment
export function playCreated() {
  try {
    const c = getCtx();
    // Rising arpeggio: C E G C E (major, bright and magical)
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      const t    = c.currentTime + i * 0.10;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
    // Shimmer twinkle on top — delayed high notes
    [2093, 2637].forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      const t    = c.currentTime + 0.28 + i * 0.11;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.10, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  } catch (_) { /* audio is optional */ }
}

// 💥 Explosion — layered boom for the lab blowing up
export function playExplosion() {
  try {
    const c = getCtx();
    const t = c.currentTime;

    // Deep low thud: lowpass-filtered noise burst
    const thud  = noiseSource(c);
    const lpf   = c.createBiquadFilter();
    const gThud = c.createGain();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(700, t);
    lpf.frequency.exponentialRampToValueAtTime(40, t + 0.55);
    gThud.gain.setValueAtTime(1.0, t);
    gThud.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    thud.connect(lpf); lpf.connect(gThud); gThud.connect(c.destination);
    thud.start(t); thud.stop(t + 0.6);

    // Rumbling oscillator that drops in pitch
    const rumble  = c.createOscillator();
    const gRumble = c.createGain();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(90, t);
    rumble.frequency.exponentialRampToValueAtTime(16, t + 0.7);
    gRumble.gain.setValueAtTime(0.55, t);
    gRumble.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    rumble.connect(gRumble); gRumble.connect(c.destination);
    rumble.start(t); rumble.stop(t + 0.7);

    // High crackle: highpass noise that cuts out fast
    const crack  = noiseSource(c);
    const hpf    = c.createBiquadFilter();
    const gCrack = c.createGain();
    hpf.type = 'highpass';
    hpf.frequency.setValueAtTime(3500, t);
    gCrack.gain.setValueAtTime(0.35, t);
    gCrack.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    crack.connect(hpf); hpf.connect(gCrack); gCrack.connect(c.destination);
    crack.start(t); crack.stop(t + 0.22);

    // Three quick aftershock pops
    [0.35, 0.52, 0.68].forEach(delay => {
      const pop  = c.createOscillator();
      const gPop = c.createGain();
      pop.type = 'sawtooth';
      pop.frequency.setValueAtTime(55, t + delay);
      pop.frequency.exponentialRampToValueAtTime(18, t + delay + 0.12);
      gPop.gain.setValueAtTime(0.25, t + delay);
      gPop.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.14);
      pop.connect(gPop); gPop.connect(c.destination);
      pop.start(t + delay); pop.stop(t + delay + 0.15);
    });
  } catch (_) { /* audio is optional */ }
}

// ── Main export ───────────────────────────────────────────────────────────────

const TYPE_SOUNDS = {
  ember:   playEmber,
  tide:    playTide,
  thorn:   playThorn,
  storm:   playStorm,
  phantom: playPhantom,
  iron:    playIron,
};

/**
 * Play the attack sound for a given creature type.
 * Falls back to Iron's clang if the type isn't recognised.
 * Errors are silently swallowed so a missing sound never breaks the game.
 */
export function playAttackSound(type) {
  try {
    (TYPE_SOUNDS[type] ?? playIron)();
  } catch (_) { /* audio is optional */ }
}
