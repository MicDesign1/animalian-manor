// gameProgress.js — Centralised story and milestone tracking for Animalian Manor.
// All data is namespaced per profile via profileKey() so two players never collide.
//
// localStorage keys (all run through profileKey):
//   'battles-won'    — integer, total arena victories
//   'story-flags'    — JSON object of named boolean flags
//   'journal-pages'  — integer 1–6, journal pages unlocked

import { profileKey, getProfiles } from './profiles';
import { isReservedArt } from './reservedArt';
import { getRandomImage } from './creatureImages';

// ── Default flag set ──────────────────────────────────────────────────────────
// Every flag starts false. Add new flags here as the story grows.

const DEFAULT_FLAGS = {
  'lawyer-letter-delivered':   false,
  'mira-bully-quest-available': false,
  'mira-bully-quest-started':  false,
  'mira-bully-quest-complete': false,
  'genesis-received':          false,
  'rekkon-received':           false,
  'old-wren-appeared':         false,
  'old-wren-page-delivered':   false,
  'study-page-hidden':         false, // page 3 is findable inside the Study
  'ransack-triggered':         false,
  'basement-discovered':       false,
  'masked-man-defeated':       false,
  'final-letter-delivered':    false,
};

// ── Milestone definitions ─────────────────────────────────────────────────────
// Each entry describes one story event that fires automatically when its
// conditions are met.  checkMilestones() compares these against live data
// and returns the IDs of any that are ready to fire right now.

export const DEV_MILESTONES = [
  {
    id:          'lawyer-letter',
    description: 'A solicitor delivers Uncle Argon\'s letter after 5 arena victories.',
    trigger:     'battlesWon >= 5 AND NOT lawyer-letter-delivered',
  },
  {
    id:          'mira-bully-quest',
    description: 'Mira pulls you aside with a favour to ask after 25 victories.',
    trigger:     'battlesWon >= 25 AND NOT mira-bully-quest-available',
  },
  {
    id:          'old-wren-appears',
    description: 'A mysterious old woman named Wren appears after Mira\'s quest is done and 50 victories.',
    trigger:     'battlesWon >= 50 AND mira-bully-quest-complete AND NOT old-wren-appeared',
  },
  {
    id:          'ransack-event',
    description: 'Someone ransacks the manor after 200 victories, hiding something in the chaos.',
    trigger:     'battlesWon >= 200 AND NOT ransack-triggered',
  },
  {
    id:          'final-letter',
    description: "The solicitor's final letter arrives after the masked man is defeated — the sequel hook.",
    trigger:     'masked-man-defeated AND NOT final-letter-delivered',
  },
];

// ── Raw read / write helpers ──────────────────────────────────────────────────

function readBattlesWon() {
  return parseInt(localStorage.getItem(profileKey('battles-won')) || '0', 10);
}

function writeBattlesWon(n) {
  localStorage.setItem(profileKey('battles-won'), String(n));
}

function readFlags() {
  try {
    const raw = localStorage.getItem(profileKey('story-flags'));
    return raw ? { ...DEFAULT_FLAGS, ...JSON.parse(raw) } : { ...DEFAULT_FLAGS };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

function writeFlags(flags) {
  localStorage.setItem(profileKey('story-flags'), JSON.stringify(flags));
}

// ── Public API ────────────────────────────────────────────────────────────────

// Returns total arena victories for the active profile.
export function getBattlesWon() {
  return readBattlesWon();
}

// Adds one victory, saves, fires checkMilestones, and returns the new total.
// The caller is responsible for acting on any returned milestone IDs.
export function incrementBattlesWon() {
  const next = readBattlesWon() + 1;
  writeBattlesWon(next);
  checkMilestones(); // fire-and-forget check; callers who need events should call it themselves
  return next;
}

// Returns the boolean value of a named story flag (false if unrecognised).
export function getStoryFlag(flagName) {
  return readFlags()[flagName] === true;
}

// Sets a named story flag and persists it.
export function setStoryFlag(flagName, value) {
  const flags = readFlags();
  flags[flagName] = Boolean(value);
  writeFlags(flags);
}

// Returns how many journal pages are currently unlocked (always 1–6).
export function getJournalPages() {
  const raw = parseInt(localStorage.getItem(profileKey('journal-pages')) || '1', 10);
  return Math.max(1, Math.min(6, raw));
}

// Saves the journal page count, clamped to 1–6.
export function setJournalPages(n) {
  localStorage.setItem(profileKey('journal-pages'), String(Math.max(1, Math.min(6, n))));
}

// Checks which milestones are ready to fire right now.
// Returns an array of milestone ID strings whose conditions are met but whose
// "delivered" flags have NOT yet been set, so the caller can show the event
// and then call setStoryFlag() to mark it done.
export function checkMilestones() {
  const battlesWon = readBattlesWon();
  const flags      = readFlags();
  const ready      = [];

  if (battlesWon >= 5 && !flags['lawyer-letter-delivered']) {
    ready.push('lawyer-letter');
  }

  if (battlesWon >= 25 && !flags['mira-bully-quest-available']) {
    ready.push('mira-bully-quest');
  }

  if (battlesWon >= 50 && flags['mira-bully-quest-complete'] && !flags['old-wren-appeared']) {
    ready.push('old-wren-appears');
  }

  if (battlesWon >= 200 && !flags['ransack-triggered']) {
    ready.push('ransack-event');
  }

  if (flags['masked-man-defeated'] && !flags['final-letter-delivered']) {
    ready.push('final-letter');
  }

  return ready;
}

// Hard-resets all story progress for the active profile back to defaults.
// Creatures and coins are left untouched.
// Requires the string 'CONFIRM' as a safety guard against accidental calls.
export function resetAllProgress(confirmationString) {
  if (confirmationString !== 'CONFIRM') {
    console.warn('resetAllProgress: pass "CONFIRM" as the argument to proceed.');
    return false;
  }
  writeBattlesWon(0);
  writeFlags({ ...DEFAULT_FLAGS });
  localStorage.setItem(profileKey('journal-pages'), '1');
  return true;
}

// ── One-time migration ────────────────────────────────────────────────────────
// Scans every profile's creature collection for any creature that accidentally
// received a reserved (legendary) art path through the random pool.
// Run once at startup, after initCreatureImages() has populated the pool.
export function migrateLegendaryCreatureArt() {
  const profiles = getProfiles();

  // Build the list of namespaced prefixes to check, plus the legacy un-namespaced key.
  const prefixes = [
    ...profiles.map(p => `${p.name}_`),
    '', // legacy un-namespaced data (single-player installs before profiles were added)
  ];

  for (const prefix of prefixes) {
    const creaturesKey = `${prefix}creatures`;
    const flagsKey     = `${prefix}story-flags`;
    const raw = localStorage.getItem(creaturesKey);
    if (!raw) continue;

    let flags = {};
    try { flags = JSON.parse(localStorage.getItem(flagsKey) || '{}'); } catch { /* ok */ }

    try {
      const creatures = JSON.parse(raw);
      let changed = false;

      const updated = creatures.map(c => {
        if (!isReservedArt(c.image)) return c;
        // Properly story-gifted legendaries: keep them.
        if (c.isLegendary) return c;
        if (c.name === 'Genesis' && flags['genesis-received']) return c;
        if (c.name === 'Rekron'  && flags['rekkon-received'])  return c;
        // Any other creature that somehow got reserved art — reassign.
        const replacement = getRandomImage();
        const profileLabel = prefix ? prefix.slice(0, -1) : '(legacy)';
        console.warn(
          `[Animalian Manor] Migrated "${c.name}" in profile "${profileLabel}": ` +
          `reserved art ${c.image} replaced with ${replacement}`
        );
        changed = true;
        return { ...c, image: replacement };
      });

      if (changed) localStorage.setItem(creaturesKey, JSON.stringify(updated));
    } catch { /* corrupt data — leave untouched */ }
  }
}
