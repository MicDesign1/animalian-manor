// reservedArt.js — Single source of truth for legendary creature image paths.
//
// Any code that picks random art MUST filter through isReservedArt() so these
// images can only appear via the story system (CroganBattle, BasementBattle).

// Lowercase basenames of the three legendary images — compared case-insensitively.
export const RESERVED_ART_FILES = ['genesis.jpg', 'rekron.jpg', 'rz.jpg'];

// Returns true if `path` refers to a reserved legendary image.
// Operates on the basename only, so it survives any folder-structure change.
// Handles: relative paths, absolute paths, leading slash, query strings.
export function isReservedArt(path) {
  if (!path || typeof path !== 'string') return false;
  const clean    = path.split('?')[0];           // strip query string
  const basename = clean.split('/').pop().toLowerCase();
  return RESERVED_ART_FILES.includes(basename);
}

// Full public paths for every legendary image.
// Import from here — never hardcode these paths elsewhere.
export const LEGENDARY_ART_PATHS = {
  genesis: '/creatures/legendary/Genesis.jpg',
  rekron:  '/creatures/legendary/Rekron.jpg',
  rz:      '/creatures/legendary/RZ.jpg',
};
