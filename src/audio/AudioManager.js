/**
 * AudioManager.js — Singleton audio controller for Animalian Manor.
 *
 * One looping <Audio> element for background music and a small pool for SFX.
 * Volume settings persist to localStorage under the active profile's namespace.
 *
 * Autoplay policy notes:
 *   - playMusic() before the first user interaction queues the track and
 *     plays it as soon as the user touches/clicks/presses anything.
 *   - playSfx() always attempts play() immediately — if the browser blocks it
 *     (no user gesture yet) it silently fails.  Once the user has interacted,
 *     all subsequent play() calls succeed.
 *
 * Paths should start with "/sounds/…" and are prefixed with BASE_URL so the
 * build works at "/" (dev) and "/play/" (animalianmanor.com production).
 */

import { profileKey } from '../data/profiles';

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE      = import.meta.env.BASE_URL;
const POOL_SIZE = 4;
const DEFAULTS  = { music: 0.12, sfx: 0.7 };

// Crossfade between tracks: 10 steps × 20 ms = 200 ms total
const FADE_STEPS    = 10;
const FADE_INTERVAL = 20;

// Loop crossfade: fade out over this many ms before the track ends, then fade back in
const LOOP_FADE_MS = 2500;

// ── Module state ──────────────────────────────────────────────────────────────

let musicEl        = null;
let sfxPool        = [];
let sfxPoolIdx     = 0;

// The path most recently requested via playMusic(), e.g. "/sounds/battle.mp3".
// Set when we commit to playing a track, before the audio starts loading.
let currentTrackPath = null;

// Track queued before the user's first interaction.
let pendingTrackPath = null;

// True once the user has interacted with the page.
let unlocked = false;

// Handle for the active track-switch crossfade interval.
let fadeTimer = null;

// Handle + flag for the loop fade-out/fade-in interval.
let loopFadeTimer  = null;
let isFadingForLoop = false;

// ── Path helper ───────────────────────────────────────────────────────────────

function resolveSrc(path) {
  // BASE is e.g. "/" or "/play/".  Strip trailing slash, then prepend.
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  return base + (path.startsWith('/') ? path : '/' + path);
}

// ── Element init ──────────────────────────────────────────────────────────────

function initMusicEl() {
  if (musicEl) return;
  musicEl        = new Audio();
  musicEl.volume = 0;

  // Manual loop with crossfade: start fading out LOOP_FADE_MS before the track ends,
  // then restart from the beginning and fade back in to the user's chosen volume.
  musicEl.addEventListener('timeupdate', () => {
    if (!musicEl.duration || musicEl.paused) return;
    if (musicEl.duration < (LOOP_FADE_MS / 1000) * 2) return; // track too short — skip
    if (isFadingForLoop || fadeTimer) return; // already fading or mid-track-switch
    if (musicEl.duration - musicEl.currentTime > LOOP_FADE_MS / 1000) return;

    isFadingForLoop = true;
    const startVol = musicEl.volume;
    let elapsed = 0;

    // Fade out
    loopFadeTimer = setInterval(() => {
      elapsed += FADE_INTERVAL;
      const t = Math.min(1, elapsed / LOOP_FADE_MS);
      musicEl.volume = Math.max(0, startVol * (1 - t));

      if (t >= 1) {
        clearInterval(loopFadeTimer);
        loopFadeTimer = null;
        musicEl.currentTime = 0;
        musicEl.play().then(() => {
          // Fade back in to the user's current volume setting
          const tv = perceptual(readVol('music-volume', DEFAULTS.music));
          let e2 = 0;
          loopFadeTimer = setInterval(() => {
            e2 += FADE_INTERVAL;
            const t2 = Math.min(1, e2 / LOOP_FADE_MS);
            musicEl.volume = tv * t2;
            if (t2 >= 1) {
              clearInterval(loopFadeTimer);
              loopFadeTimer = null;
              musicEl.volume = tv;
              isFadingForLoop = false;
            }
          }, FADE_INTERVAL);
        }).catch(() => { isFadingForLoop = false; });
      }
    }, FADE_INTERVAL);
  });
}

function initPool() {
  if (sfxPool.length) return;
  for (let i = 0; i < POOL_SIZE; i++) sfxPool.push(new Audio());
}

// ── Volume helpers ────────────────────────────────────────────────────────────

function readVol(key, def) {
  try {
    const raw = localStorage.getItem(profileKey(key));
    if (raw === null) return def;
    const v = parseFloat(raw);
    return isNaN(v) ? def : Math.max(0, Math.min(1, v));
  } catch { return def; }
}

// Squared curve so a 50% slider position sounds like half loudness.
function perceptual(v) { return v * v; }

// ── Autoplay unlock ───────────────────────────────────────────────────────────

function doUnlock() {
  if (unlocked) return;
  unlocked = true;
  // Remove all the unlock listeners — no longer needed.
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(ev =>
    window.removeEventListener(ev, doUnlock, { capture: true })
  );
  // Play the track that was requested before the first interaction.
  if (pendingTrackPath) {
    const track = pendingTrackPath;
    pendingTrackPath = null;
    _startMusic(track);
  }
}

if (typeof window !== 'undefined') {
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(ev =>
    window.addEventListener(ev, doUnlock, { capture: true })
  );
}

// ── Internal music start ──────────────────────────────────────────────────────

function _doFadeIn(src, targetVol) {
  musicEl.src = src;
  musicEl.volume = 0;
  musicEl.play().then(() => {
    let step = 0;
    fadeTimer = setInterval(() => {
      step++;
      musicEl.volume = Math.min(targetVol, targetVol * step / FADE_STEPS);
      if (step >= FADE_STEPS) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        musicEl.volume = targetVol;
      }
    }, FADE_INTERVAL);
  }).catch(err => {
    // In development, surface failures so you can see what went wrong.
    if (import.meta.env.DEV) console.warn('[AudioManager] music play() failed:', err);
  });
}

// Core play-a-track logic, called only when unlocked === true.
function _startMusic(trackPath) {
  initMusicEl();
  const src       = resolveSrc(trackPath);
  const targetVol = perceptual(readVol('music-volume', DEFAULTS.music));

  if (fadeTimer)     { clearInterval(fadeTimer);     fadeTimer     = null; }
  if (loopFadeTimer) { clearInterval(loopFadeTimer); loopFadeTimer = null; }
  isFadingForLoop = false;

  const isPlaying = !!musicEl.src && !musicEl.paused;

  if (isPlaying) {
    // Fade the current track out, then fade the new one in.
    const startVol = musicEl.volume;
    let step = 0;
    fadeTimer = setInterval(() => {
      step++;
      musicEl.volume = Math.max(0, startVol * (1 - step / FADE_STEPS));
      if (step >= FADE_STEPS) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        musicEl.pause();
        musicEl.currentTime = 0;
        _doFadeIn(src, targetVol);
      }
    }, FADE_INTERVAL);
  } else {
    _doFadeIn(src, targetVol);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Play a looping background music track.
 * If the same track is already playing, does nothing.
 * If called before the first user interaction, the call is queued and fires
 * automatically when the user next interacts with the page.
 *
 * @param {string} trackPath  e.g. "/sounds/battle.mp3"
 */
function playMusic(trackPath) {
  if (!trackPath) return;

  // Same track already committed — skip.
  if (currentTrackPath === trackPath) return;
  currentTrackPath = trackPath;

  if (!unlocked) {
    // Queue it; doUnlock() will call _startMusic() on the first gesture.
    pendingTrackPath = trackPath;
    return;
  }

  _startMusic(trackPath);
}

/**
 * Stop background music immediately.
 */
function stopMusic() {
  if (fadeTimer)     { clearInterval(fadeTimer);     fadeTimer     = null; }
  if (loopFadeTimer) { clearInterval(loopFadeTimer); loopFadeTimer = null; }
  isFadingForLoop = false;
  if (musicEl) { musicEl.pause(); musicEl.currentTime = 0; }
  currentTrackPath = null;
}

/**
 * Play a one-shot sound effect.
 * Uses a round-robin pool so multiple sounds can overlap.
 * Does NOT check the unlocked flag — SFX triggered from button clicks are
 * already within a user gesture and the browser allows them directly.
 *
 * @param {string} filename  e.g. "/sounds/crowd-cheer.mp3"
 */
function playSfx(filename) {
  initPool();
  const el = sfxPool[sfxPoolIdx];
  sfxPoolIdx = (sfxPoolIdx + 1) % POOL_SIZE;
  try {
    el.pause();
    el.currentTime = 0;
    el.src    = resolveSrc(filename);
    el.volume = perceptual(readVol('sfx-volume', DEFAULTS.sfx));
    el.play().catch(err => {
      if (import.meta.env.DEV) console.warn('[AudioManager] sfx play() failed:', err);
    });
  } catch (_) { /* audio is optional — never break the game */ }
}

/**
 * Play the type-appropriate hit sound scaled by damage intensity.
 *
 *   damage < 33% of defender's max HP → [type]-hit1  (glancing blow)
 *   33–66%                            → [type]-hit2  (solid hit)
 *   66%+                              → [type]-hit3  (heavy hit)
 *
 * Always pass the attack's own type, not the creature's primary type
 * (matters for dual-type creatures like Genesis, Rekron, RZ).
 *
 * @param {string} type       e.g. "ember"
 * @param {number} damage     actual damage dealt
 * @param {number} maxDamage  defender's max HP
 */
function playHit(type, damage, maxDamage) {
  // Raw damage thresholds — most attacks land between 15 and 80 damage
  const variant = damage < 25 ? 1 : damage < 50 ? 2 : 3;
  playSfx(`/sounds/${type}-hit${variant}.mp3`);
}

/**
 * Set music volume (0–1).  Persists to localStorage.  Applies immediately.
 */
function setMusicVolume(val) {
  const v = Math.max(0, Math.min(1, val));
  try { localStorage.setItem(profileKey('music-volume'), String(v)); } catch (_) {}
  if (musicEl && !fadeTimer) musicEl.volume = perceptual(v);
}

/**
 * Set SFX volume (0–1).  Persists to localStorage.
 * Picked up on the next playSfx() call.
 */
function setSfxVolume(val) {
  const v = Math.max(0, Math.min(1, val));
  try { localStorage.setItem(profileKey('sfx-volume'), String(v)); } catch (_) {}
}

/** Returns the current music volume setting (0–1). */
function getMusicVolume() { return readVol('music-volume', DEFAULTS.music); }

/** Returns the current SFX volume setting (0–1). */
function getSfxVolume()   { return readVol('sfx-volume', DEFAULTS.sfx); }

/**
 * Returns the path of the currently committed music track,
 * e.g. "/sounds/battle.mp3".  Used by StoryLetter to restore
 * the previous track when a narrative overlay closes.
 */
function getCurrentTrack() { return currentTrackPath; }

/**
 * Pause all audio — music and all SFX pool elements.
 * Useful from the DevConsole.
 */
function stopAll() {
  stopMusic();
  sfxPool.forEach(el => { try { el.pause(); el.currentTime = 0; } catch (_) {} });
}

/**
 * Clear saved volume settings for the active profile and reset to defaults.
 */
function resetAudioSettings() {
  try { localStorage.removeItem(profileKey('music-volume')); } catch (_) {}
  try { localStorage.removeItem(profileKey('sfx-volume'));   } catch (_) {}
  if (musicEl && !fadeTimer) musicEl.volume = perceptual(DEFAULTS.music);
}

// ── Export ────────────────────────────────────────────────────────────────────

const AudioManager = {
  playMusic,
  stopMusic,
  playSfx,
  playHit,
  setMusicVolume,
  setSfxVolume,
  getMusicVolume,
  getSfxVolume,
  getCurrentTrack,
  stopAll,
  resetAudioSettings,
};

export default AudioManager;
