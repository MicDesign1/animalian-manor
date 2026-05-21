// Creature image paths are loaded at startup from the auto-generated manifest.
// Call initCreatureImages() once before mounting React (see main.jsx),
// then getRandomImage() is safe to call synchronously anywhere.
//
// The manifest covers only /creatures/*.jpg (not /creatures/legendary/).
// Reserved legendary art is also filtered here as a belt-and-suspenders guard.

import { isReservedArt } from './reservedArt';

// Root folder for random creature art — centralised so nothing else hardcodes it.
export const RANDOM_ART_DIR = '/creatures/';

let _images = [];

export async function initCreatureImages() {
  try {
    const res = await fetch('/creatures/manifest.json');
    const all = await res.json();
    // Strip reserved art at load time so legendaries can never surface randomly.
    _images = all.filter(p => !isReservedArt(p));
  } catch (err) {
    console.error('Could not load creature manifest:', err);
  }
}

export function getRandomImage() {
  if (!_images.length) return '';
  // _images is already filtered; this loop is a safety net for stale manifests.
  for (let i = 0; i < _images.length; i++) {
    const candidate = _images[Math.floor(Math.random() * _images.length)];
    if (!isReservedArt(candidate)) return candidate;
  }
  return '';
}
