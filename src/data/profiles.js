// Profile management — multi-player support.
// All game data is namespaced per profile so two kids never overwrite each other.

const PROFILES_KEY   = 'animalian_profiles';
const ACTIVE_KEY     = 'animalian_activeProfile';
const INTRO_SEEN_KEY = 'animalian_introSeen';

// Victorian-themed avatar options shown on the player creation screen.
export const PORTRAITS = [
  { emoji: '🎩', bg: '#5C3A1E' },
  { emoji: '🌺', bg: '#8B2500' },
  { emoji: '🦉', bg: '#4A1942' },
  { emoji: '🐾', bg: '#1E5631' },
  { emoji: '🌿', bg: '#1B4F72' },
  { emoji: '⚗️', bg: '#7D5A00' },
  { emoji: '🔭', bg: '#2C1810' },
  { emoji: '🦋', bg: '#8B6914' },
];

export function getProfiles() {
  return JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]');
}

export function getActiveProfileName() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}

export function getActiveProfile() {
  const name = getActiveProfileName();
  if (!name) return null;
  return getProfiles().find(p => p.name === name) || null;
}

export function setActiveProfile(name) {
  localStorage.setItem(ACTIVE_KEY, name);
}

export function clearActiveProfile() {
  localStorage.removeItem(ACTIVE_KEY);
}

export function createProfile(data) {
  const profiles = getProfiles();
  profiles.push({ ...data, createdAt: new Date().toISOString() });
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

// Returns a namespaced localStorage key for the currently active profile.
// e.g. profileKey('creatures') → 'Thomas_creatures'
export function profileKey(suffix) {
  const name = getActiveProfileName();
  return name ? `${name}_${suffix}` : suffix;
}

export function isIntroSeen() {
  const key = profileKey('intro-seen');
  if (localStorage.getItem(key) === 'true') return true;
  // Backward compat: a profile with existing battle history was created before this flag existed.
  // Treat them as having seen the intro and migrate the flag so this only runs once.
  const battlesWon = parseInt(localStorage.getItem(profileKey('battles-won')) || '0', 10);
  if (battlesWon > 0) {
    localStorage.setItem(key, 'true');
    return true;
  }
  return false;
}

export function markIntroSeen() {
  localStorage.setItem(profileKey('intro-seen'), 'true');
}

export function getProfileCreatureCount(profileName) {
  return JSON.parse(localStorage.getItem(`${profileName}_creatures`) || '[]').length;
}

// Delete a profile and wipe all of its namespaced localStorage data.
export function deleteProfile(name) {
  const updated = getProfiles().filter(p => p.name !== name);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
  if (getActiveProfileName() === name) clearActiveProfile();
  const prefix = `${name}_`;
  Object.keys(localStorage)
    .filter(k => k.startsWith(prefix))
    .forEach(k => localStorage.removeItem(k));
}

// One-time migration: if old un-namespaced data exists but no profiles yet,
// move everything under a "Player 1" profile so nothing is lost.
export function migrateExistingData() {
  if (getProfiles().length > 0) return;
  const oldCreatures = localStorage.getItem('animalian-creatures');
  const oldCoins     = localStorage.getItem('animalian-coins');
  if (!oldCreatures && !oldCoins) return; // completely fresh install

  createProfile({ name: 'Player 1', title: 'nephew', portrait: 0 });
  if (oldCreatures) localStorage.setItem('Player 1_creatures', oldCreatures);
  if (oldCoins)     localStorage.setItem('Player 1_coins', oldCoins);
  const oldVault   = localStorage.getItem('animalian-vault-discovered');
  const oldMystery = localStorage.getItem('animalian-mystery-met');
  if (oldVault)   localStorage.setItem('Player 1_vault-discovered', oldVault);
  if (oldMystery) localStorage.setItem('Player 1_mystery-met', oldMystery);
}
