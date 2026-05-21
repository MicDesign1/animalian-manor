import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileKey, getActiveProfile } from '../data/profiles';
import { getBattlesWon, getStoryFlag, setStoryFlag, getJournalPages, setJournalPages, resetAllProgress } from '../data/gameProgress';
import { getRandomImage } from '../data/creatureImages';
import StoryLetter from '../components/StoryLetter';
import AudioManager from '../audio/AudioManager';
import './Parlor.css';

// ── Mira's shop system ────────────────────────────────────────────────────────

const SHOP_RESTOCK_MS = 20 * 60 * 1000; // 20 min after last card is bought
const BUYBACK_LIMIT   = 8;              // max creatures on the buyback shelf

// Daily sell tracking — resets automatically each calendar day
function getToday() { return new Date().toISOString().slice(0, 10); }
function loadDailySales() {
  try {
    const raw = localStorage.getItem(profileKey('mira-daily-sales'));
    if (!raw) return 0;
    const obj = JSON.parse(raw);
    return obj.date === getToday() ? (obj.count || 0) : 0;
  } catch { return 0; }
}
function saveDailySales(count) {
  localStorage.setItem(profileKey('mira-daily-sales'), JSON.stringify({ count, date: getToday() }));
}

function msToLabel(ms) {
  if (ms <= 0) return null;
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${totalMin} min`;
}

// miraShop: { inventory, buyback, restockTime (ISO string|null), restocksToday, date, lastBaseIds }
function loadMiraShop() {
  const today = getToday();
  const blank = { inventory: [], buyback: [], restockTime: null, restocksToday: 0, date: today, lastBaseIds: [] };
  try {
    const raw = localStorage.getItem(profileKey('mira-shop'));
    if (!raw) return blank;
    const obj = JSON.parse(raw);
    // Reset daily restock count on a new day, keep inventory and buyback
    return obj.date !== today
      ? { ...blank, inventory: obj.inventory || [], buyback: obj.buyback || [], lastBaseIds: obj.lastBaseIds || [] }
      : { ...blank, ...obj };
  } catch { return blank; }
}
function saveMiraShop(shop) {
  localStorage.setItem(profileKey('mira-shop'), JSON.stringify(shop));
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NOTICE_BOARD = [
  '📌 WANTED: Two Coralfin, will trade a Thornback. Ask at the bar.',
  '📌 LOST: One small field journal, green cover. Reward offered.',
  '📌 TOURNAMENT: The Autumn Cup returns next season. Register with the Scholar.',
  '📌 FOR SALE: Expedition-grade specimen jars, set of six. Barely used.',
  '📌 NOTICE: The west corridor remains sealed per Uncle Argon\'s instruction.',
  '📌 RUMOUR: Someone seen near the study at midnight. Candle glow under the door.',
  '📝 SUGGESTION BOX: Have thoughts about the manor? Leave a note for the owners below.',
];

const TYPE_COLORS = {
  ember:   '#8B2500',
  tide:    '#1B4F72',
  thorn:   '#1E5631',
  storm:   '#7D5A00',
  phantom: '#4A1942',
  iron:    '#1A1A1A',
};

const TYPE_ICONS = {
  ember: '🔥', tide: '💧', thorn: '🌿',
  storm: '⚡', phantom: '👁️', iron: '⚙️',
};

// Attacks per type — scaled by level when stock is generated
const TYPE_ATTACKS = {
  ember:   [{ name: 'Fire Claw',     damage: 28 }, { name: 'Inferno Burst', damage: 44 }],
  tide:    [{ name: 'Wave Crash',    damage: 24 }, { name: 'Riptide',       damage: 38 }],
  thorn:   [{ name: 'Vine Lash',     damage: 22 }, { name: 'Root Crush',    damage: 42 }],
  storm:   [{ name: 'Static Shock',  damage: 20 }, { name: 'Thunder Strike', damage: 50 }],
  phantom: [{ name: 'Shadow Fang',   damage: 28 }, { name: 'Void Pulse',    damage: 44 }],
  iron:    [{ name: 'Steel Slam',    damage: 32 }, { name: 'Forge Bash',    damage: 38 }],
};

// ── Mira's creature pool (larger variety to pick from) ────────────────────────
const MIRA_POOL = [
  { id: 'p01', name: 'Cinderfox',   type: 'ember',   hp: 90,  atk: 55, def: 30, spd: 70, basePrice: 28 },
  { id: 'p02', name: 'Emberveil',   type: 'ember',   hp: 95,  atk: 60, def: 25, spd: 75, basePrice: 32 },
  { id: 'p03', name: 'Coralfin',    type: 'tide',    hp: 110, atk: 45, def: 50, spd: 55, basePrice: 30 },
  { id: 'p04', name: 'Tidecrawler', type: 'tide',    hp: 120, atk: 40, def: 60, spd: 45, basePrice: 28 },
  { id: 'p05', name: 'Thornback',   type: 'thorn',   hp: 130, atk: 40, def: 70, spd: 35, basePrice: 28 },
  { id: 'p06', name: 'Mossback',    type: 'thorn',   hp: 125, atk: 35, def: 75, spd: 30, basePrice: 26 },
  { id: 'p07', name: 'Galehawk',    type: 'storm',   hp: 80,  atk: 65, def: 25, spd: 90, basePrice: 35 },
  { id: 'p08', name: 'Voltspark',   type: 'storm',   hp: 85,  atk: 70, def: 20, spd: 85, basePrice: 33 },
  { id: 'p09', name: 'Mirrorfiend', type: 'phantom', hp: 100, atk: 60, def: 45, spd: 60, basePrice: 42 },
  { id: 'p10', name: 'Duskmourn',   type: 'phantom', hp: 105, atk: 55, def: 50, spd: 65, basePrice: 38 },
  { id: 'p11', name: 'Ironclad',    type: 'iron',    hp: 160, atk: 35, def: 80, spd: 20, basePrice: 30 },
  { id: 'p12', name: 'Cobbleboar',  type: 'iron',    hp: 150, atk: 40, def: 75, spd: 25, basePrice: 28 },
];

// Level scaling: stat multiplier, price scale, star display
const LEVEL_DATA = {
  1: { statMult: 1.00, priceScale: 1.0, stars: '✦'    },
  2: { statMult: 1.25, priceScale: 1.8, stars: '✦✦'   },
  3: { statMult: 1.55, priceScale: 3.0, stars: '✦✦✦'  },
};

// Dynamic sell offer from Mira — price drops across 5 daily sales, quality bonus 1.5×.
// Quality = has image + has color tint + combined combat stats (atk+def+spd) > 150.
const MIRA_MAX_DAILY = 5;

function getMiraOffer(creature, dailyCount, playerName) {
  const name = playerName || 'friend';

  if (dailyCount >= MIRA_MAX_DAILY) {
    return {
      closed: true, price: 0, isQuality: false,
      line: `"I've spent all my coin for today, ${name}. Come back tomorrow."`,
    };
  }

  const isQuality = !!(
    creature.image &&
    creature.imageColor &&
    (creature.atk || 0) + (creature.def || 0) + (creature.spd || 0) > 150
  );

  const basePrice = Math.floor(
    ((creature.hp || 0) + (creature.atk || 0) + (creature.def || 0) + (creature.spd || 0)) / 4
  );

  const TIER_MULTS = [1.00, 1.00, 0.75, 0.50, 0.25];
  const TIER_LINES = [
    [`"A fine specimen, ${name}. Full price."`,    '"Lovely. I\'ll take it at full value."'],
    [`"Happy to trade, ${name}. Still paying top."`, '"Good quality — fair price."'],
    [`"I\'ve bought quite a few today… three-quarters, ${name}."`, '"Slight discount. I\'m running a business here."'],
    ['"My purse is feeling lighter. Half-price — take it or leave it."', '"Best I can do at this point."'],
    [`"Last one, barely breaking even, ${name}."`, '"You\'re bleeding me dry. Final offer."'],
  ];

  const mult  = TIER_MULTS[dailyCount];
  const price = Math.max(5, Math.floor(basePrice * mult * (isQuality ? 1.5 : 1)));
  const line  = pick(TIER_LINES[dailyCount]);
  return { closed: false, price, isQuality, line };
}

// Average stat power score for the player's collection (atk+def+spd / 3 per creature)
function playerPowerScore(collection) {
  if (!collection || collection.length === 0) return 40; // default mid-range
  const total = collection.reduce(
    (sum, c) => sum + ((c.atk || 40) + (c.def || 40) + (c.spd || 40)) / 3,
    0
  );
  return total / collection.length;
}

// Pick the best level for a Mira card relative to the player's score.
// above=false → highest level whose score is still ≤ playerScore (similar / weaker)
// above=true  → lowest level whose score exceeds playerScore (stronger)
function levelForTarget(base, playerScore, above) {
  const baseScore = (base.atk + base.def + base.spd) / 3;
  if (above) {
    for (const L of [1, 2, 3]) {
      if (baseScore * LEVEL_DATA[L].statMult > playerScore) return L;
    }
    return 3; // already stronger at LV1 — cap at max
  } else {
    for (const L of [3, 2, 1]) {
      if (baseScore * LEVEL_DATA[L].statMult <= playerScore) return L;
    }
    return 1; // even LV1 exceeds player — use minimum
  }
}

// Generate 5 inventory cards scaled to the player's collection strength.
// Tries to avoid repeating the same base creatures as the last batch.
// 2 "above-player" slots (≈40%), 3 at/below player power.
function generateInventory(collection, excludeBaseIds = []) {
  const pScore   = playerPowerScore(collection);
  const excluded = new Set(excludeBaseIds);
  const available = MIRA_POOL.filter(c => !excluded.has(c.id));
  const pool      = available.length >= 5 ? available : MIRA_POOL;
  const selected  = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  const aboveSet  = new Set([0,1,2,3,4].sort(() => Math.random() - 0.5).slice(0, 2));

  return selected.map((base, i) => {
    const level = levelForTarget(base, pScore, aboveSet.has(i));
    const { statMult, priceScale, stars } = LEVEL_DATA[level];
    const sc  = v => Math.round(v * statMult);
    const img = getRandomImage();
    return {
      ...base,
      baseId:        base.id,
      id:            `mira-${base.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      level, xp: 0, stars,
      hp:            sc(base.hp), currentHp: sc(base.hp),
      atk:           sc(base.atk), def: sc(base.def), spd: sc(base.spd),
      price:         Math.round(base.basePrice * priceScale),
      image:         img, imagePosition: { x: 50, y: 50 },
      attacks:       (TYPE_ATTACKS[base.type] || TYPE_ATTACKS.iron).map(a => ({
        name: a.name, damage: sc(a.damage), type: base.type,
      })),
    };
  });
}

// Mira's one-line opinion on a specific creature (shown when player taps a card)
function getMiraCommentary(creature) {
  const { atk = 40, def = 40, spd = 40, hp = 90, type } = creature;
  const candidates = [];

  if (atk - def > 20)      candidates.push(`"A glass cannon — hits hard, won't take many hits back. Exciting, but risky."`);
  if (def - atk > 20)      candidates.push(`"Tough as old boots. Won't hit hard, but it won't go down easy either."`);
  if (spd >= 75)           candidates.push(`"Quick little thing. Goes first in battle — very useful for landing that first strike."`);
  if (spd <= 25)           candidates.push(`"Slow, but sometimes slow and steady wins. Especially with high defence."`);
  if (hp >= 150)           candidates.push(`"Remarkable constitution. Takes a real beating before it goes down."`);
  if (atk + def + spd > 190) candidates.push(`"A fine all-rounder. Good at everything — hard to find ones like this."`);

  const typeLines = {
    ember:   `"Ember types hit hard. Strong against Thorn, but Tide will weather them out."`,
    tide:    `"Tide types are reliable. Strong against Ember, though Storms can push them around."`,
    thorn:   `"Thorn types are methodical. They outlast Tide, but Ember burns right through them."`,
    storm:   `"Storms are wild cards — brilliant against Tide, but Thorn tangles them up."`,
    phantom: `"Phantom types do well against anyone — that's their trick. Rare, and priced accordingly."`,
    iron:    `"Iron types have no elemental edge, but they're steady. A reliable backbone for any team."`,
  };
  if (typeLines[type]) candidates.push(typeLines[type]);

  return candidates.length > 0 ? pick(candidates) : `"A solid specimen. You could do a lot worse."`;
}

// Mira's spoken lines — indexed by situation
const MIRA_QUIPS = {
  fresh:    ['"Fresh stock just in — have a look."', '"Something for every type. Take your time."', '"Hot off the field, these ones."'],
  existing: ['"Still good ones left. Don\'t wait too long."', '"Same lot — see anything you fancy?"', '"A few still on the table. Good quality."'],
  restock:  ['"I\'m back! Wait until you see what I found at the village market…"', '"A travelling naturalist sold me some fascinating specimens!"', '"New batch, fresh from the field. You\'ll like these."'],
  partial:  ['"Still interested in these? I think that one would suit your collection nicely."', '"I\'ve kept these aside — just waiting for the right buyer."'],
  empty:    ['"You\'ve bought everything I\'ve got! Let me take a trip to the village — I\'ll find some new specimens for you."'],
  bothSides:['"Fresh stock on the left, and some familiar faces on the right."'],
  buybackOnly:['"I\'m out of new finds, but your old friends are still here if you want them back!"'],
};

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const NPC_LINES_STAGED = {
  barkeep: {
    new: [
      "Welcome, welcome. Pull up a stool. You must be Argon's heir — you've got his eyes.",
      "He used to sit right there in the corner booth, filling that old journal for hours. Never said what he was writing.",
      "Rumour has it the trophy room holds more than trophies, if you catch my meaning.",
      "If you're looking to trade, Mira's your person. Sharp as a brass tack, that one. Fair, though.",
      "One last thing — if you find yourself in the study late at night, best not to pull on books at random. Or maybe do. Heh.",
    ],
    early: [
      "Word travels fast around here. They're saying the heir's been making a name in the Arena.",
      "Your uncle had the same fire in his early days. Won every match for six months straight. Wonderful times.",
      "Mira tells me you've been in her corner a few times. Good taste — she finds creatures nobody else can.",
      "The Scholar gets a bit excited when new visitors arrive. Don't let him lecture you past closing time.",
      "I've heard your creatures fight well. That's the sort of thing your uncle would've loved to know.",
    ],
    mid: [
      "You heard about Crogan? Thick-necked fellow, used to come in here demanding free rounds. He's gone quiet lately. Something to do with you, I'd wager.",
      "The village market's breathing easier since Crogan stopped showing up. You did good, even if you won't say so.",
      "Some of the older regulars have been asking about you. You're becoming part of the furniture here, in the best way.",
      "Your uncle always said this place needed someone who'd actually fight for it. Seems he was right.",
      "The notice board's seen a few fewer WANTED signs lately. I suspect that's your doing too.",
    ],
    late: [
      "Strange nights lately. I keep hearing things below the manor — deep in the walls, almost. Probably nothing. Probably.",
      "One of the kitchen staff swore she heard footsteps beneath the cellar last week. I told her it was old pipes. I'm not entirely sure I believe that.",
      "Your uncle's last letters mentioned something about a discovery. He didn't elaborate. He was always careful with his words near the end.",
      "There's a kind of tension in this place now, has been for weeks. Like the manor is waiting for something.",
      "Whatever you've been chasing, you're close. I can feel it the way you feel weather before it turns. Keep going.",
    ],
    postgame: [
      "There it is. I always knew you'd see it through — same as Argon would have wanted.",
      "The manor feels different today. Lighter, somehow. Like it's been holding its breath for years and finally let go.",
      "I've served drinks in this parlour for thirty years. I've never seen anything like what you've managed. Not once.",
      "Whatever that thing was that you faced down there — it's gone now. The whole village feels it, even if they don't know why.",
      "Your uncle would've been proud. Genuinely. Now sit down and let me get you something warm — you've earned it.",
    ],
  },
  collector: {
    new: [
      "So you're Argon's {title}! He talked about you all the time! I collect creatures too — well, trying to.",
      "I got up to fourteen cards before my Thornback escaped. Don't ask how a card escapes. It was a whole thing.",
      "Your uncle once told me the best secrets are hidden in plain sight. Right where you'd never think to look.",
      "He specifically mentioned the study. Said the real adventure starts with the right book. Weird, right?",
    ],
    early: [
      "Wait — you've been winning actual Arena matches? That's incredible. My best streak is three and I told everyone about it for a week.",
      "Which creatures have you got so far? I've been trying to find a Galehawk for ages — the speed on those things is unreal.",
      "Mira's stock changes all the time, right? I keep visiting but she never has what I'm looking for. Story of my life.",
      "I heard Phantom types are stronger than anything at full power. Have you faced one yet? What was it like?",
      "You're actually doing it. Like, for real. I'm kind of in awe right now.",
    ],
    mid: [
      "Hey, have you heard about Crogan? Someone at the market said a young trainer from the manor beat him. Was that you?",
      "If it was you who stopped Crogan — the village traders are all talking about it. You're basically a legend now.",
      "I tried to build an Ember team but I keep losing to Tide. Do you just stack your types or mix them up?",
      "My collection's up to twenty-two now! Still no Galehawk though. I'm starting to think they don't exist.",
      "Every time I come in here I hear a new story about what you've been up to. It's wild. You're like, actually famous.",
    ],
    late: [
      "Okay, I have to ask — do you ever get a weird feeling in the manor at night? Like something's... watching?",
      "I visited the menagerie last week and two of my cards just started acting strange. Trembling in their cases. I've never seen that before.",
      "Something's wrong, isn't it. I can tell by the way people are acting around here. Even Elias looks worried.",
      "I keep hearing this low sound, like — I don't know, like something breathing, coming up through the floor. Please tell me you know what that is.",
      "You're still collecting, right? Still battling? Good. Whatever's going on, I feel safer knowing you're here.",
    ],
    postgame: [
      "WAIT. Was that — did you actually — there was something HUGE going on and you defeated it, didn't you?!",
      "I need you to tell me everything. From the beginning. Every single thing. I have snacks. We have time.",
      "You actually went into the basement and came back. I didn't even know you could come back from that.",
      "My whole collection feels different now. Like the cards know something changed. Is that weird? That's probably weird.",
      "You're officially the most interesting person I've ever met. And I once met a creature merchant who'd been bitten by every type. So that's saying something.",
    ],
  },
  scholar: {
    new: [
      "Ah, a new student of the natural sciences! Do sit. There is always room at a scholar's table.",
      "The six elemental types were first catalogued by the explorer Isadora Venn in 1847. Fascinating woman. Dreadful handwriting.",
      "Phantom-type creatures are the most enigmatic — they seem to draw power from uncertainty itself. Most unsettling.",
      "Ember overcomes Thorn, Thorn overcomes Tide, Tide overcomes Ember. The eternal triangle. Storm breaks the pattern entirely.",
      "Your uncle's collection was unprecedented. Some specimens he described... I confess I thought him fanciful. I no longer do.",
    ],
    early: [
      "Type advantage is the cornerstone of battle strategy. A Tide creature against an Ember opponent deals fifty percent more damage. That alone can decide a match.",
      "Iron types are often underestimated. They carry no elemental weakness — but equally no advantage. Reliable in the way that a good stone wall is reliable.",
      "Storm types are peculiar. Dominant against Tide, but Thorn tangles them badly. Trainers who use Storm rely on speed — strike first, ask questions later.",
      "Phantom types deal twenty-five percent extra damage to everything. The tradeoff is they take twenty-five percent more in return. High risk. High reward.",
      "I always advise new trainers: build your first team around type coverage, not individual strength. A well-rounded team beats a powerful one-note team every time.",
    ],
    mid: [
      "I have been developing a theory — what if a creature could express two elemental types simultaneously? Not alternating. Both, at once. The mathematics are extraordinary.",
      "Consider: if Ember and Thorn coexisted in a single specimen, the opposing advantages would create an internal tension. Either catastrophically unstable — or transcendently powerful.",
      "Your uncle's notes referenced something called the 'convergence point' — a location where type boundaries break down. I dismissed it as poetry. I am less certain now.",
      "There are creatures your uncle catalogued that do not fit any of the six known types. I have catalogued seventeen such anomalies. Each one makes my taxonomy weaker and more interesting.",
      "Dual-type theory is currently considered fringe science. I suspect that in twenty years it will be considered foundational. That is usually how it goes.",
    ],
    late: [
      "The deeper one studies elemental theory, the more one suspects that the six types are not the source — merely the symptoms. Something underlies them. Something older.",
      "There are accounts — suppressed, mostly, from the 1890s — of creatures that existed before the type system was understood. The descriptions do not match any known category.",
      "I have been running calculations on the energy readings your uncle sent back from his final expedition. The numbers should not be possible. And yet.",
      "Some creatures, I believe, do not originate in the natural world as we understand it. They arrive from somewhere else. Through somewhere else. The mathematics suggest a membrane of some kind.",
      "I will say this plainly: if you find something in this manor that defies classification — do not assume it is harmless. Unprecedented things rarely are.",
    ],
    postgame: [
      "So. The convergence point was real. I owe your uncle a very significant apology.",
      "What you encountered — I have been trying to classify it since you described it. My best term is 'origin-class.' A creature that predates the type system entirely. Possibly predates the manor.",
      "The academic world will not believe this for at least a decade. I intend to publish regardless. I have nothing left to lose by being right.",
      "There is a strange irony: the most important discovery in elemental history was made not by a scholar, but by an heir who simply refused to leave well enough alone.",
      "Well done. Genuinely. Now — if you could write down everything you remember, in order, with as much detail as possible — I have paper. I have time. And a great deal of questions.",
    ],
  },
};

function getProgressStage() {
  if (getStoryFlag('masked-man-defeated')) return 'postgame';
  const wins = getBattlesWon();
  if (wins >= 100) return 'late';
  if (wins >= 25)  return 'mid';
  if (wins >= 5)   return 'early';
  return 'new';
}

function getNpcLines(npcKey, playerTitle) {
  const lines = NPC_LINES_STAGED[npcKey][getProgressStage()];
  if (!playerTitle) return lines;
  return lines.map(l => l.replace('{title}', playerTitle));
}

const NPC_LINES = {
  mystery: [
    "...",
    "You should not be speaking to me. And yet here we both are.",
    "Your uncle found something on his last expedition. Something that does not fit into any of the six types.",
    "He sent coordinates. He sent a cipher. He sent everything except himself.",
    "When the time comes, you will know what to do. You already have everything you need.",
  ],
  wren: [
    "Well, well. You must be Argon's heir. I'd recognise that look anywhere — same curiosity he had.",
    "I'm Wren. Used to tend the grounds here, years back. Your uncle and I would talk for hours about his creatures.",
    "I saw him arguing with someone outside the village, the week before he left. A tall man. Didn't get a good look at his face.",
    "Anyway — your uncle left something at my cottage. Told me to keep it safe. I figure it belongs to you now.",
  ],
  wrenAfter: [
    "Nothing more from me, I'm afraid. But I hope that page helps you understand what your uncle was mixed up in.",
    "Take care of this place. He loved it more than anywhere else in the world.",
  ],
};

const ENCOURAGEMENT_LINES = {
  early: [
    "Heard you've been making a name for yourself in the Arena. Keep it up.",
    "Word travels fast around here. They say your creatures fight well.",
    "I've heard you've been winning. Good start.",
    "The Arena crowd's been talking. They like what they see.",
    "Not many newcomers last this long. You've got something.",
  ],
  mid: [
    "People are starting to recognise you when you walk in. That's not nothing.",
    "I've been keeping count. The Arena hasn't seen a streak like yours in a while.",
    "A trader came through the village asking about the young heir winning battles. That's you, isn't it?",
    "Your uncle would be pleased. He always said the creatures chose their trainer, not the other way round.",
    "They're telling stories about your team at the market. Keep going.",
    "Rumour has it even some of the travelling challengers have been asking about you.",
  ],
  high: [
    "Whatever you're chasing — you're getting close. I can feel it.",
    "There's something different about this manor lately. Like it's been holding its breath.",
    "The old-timers say strange things happen here when someone truly earns the estate's trust. You're not far off.",
    "Your uncle disappeared looking for answers. You might be the one to find them.",
    "Almost every room in this manor has opened up for you now. Feels like the manor wants you here.",
    "Keep winning. I don't know why, but it matters. It really does.",
  ],
};

// ── Typewriter hook ───────────────────────────────────────────────────────────

function useTypewriter(speed = 22) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);
  const idxRef  = useRef(0);
  const textRef = useRef('');

  const start = useCallback((t) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    textRef.current = t;
    idxRef.current  = 0;
    setDisplayed('');
    setDone(false);
    intervalRef.current = setInterval(() => {
      idxRef.current += 1;
      setDisplayed(textRef.current.slice(0, idxRef.current));
      if (idxRef.current >= textRef.current.length) {
        clearInterval(intervalRef.current);
        setDone(true);
      }
    }, speed);
  }, [speed]);

  const finish = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setDisplayed(textRef.current);
    setDone(true);
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return { displayed, done, start, finish };
}

// ── Mini creature card ────────────────────────────────────────────────────────

function MiniCard({ creature, mode, coins, onBuy, onSell, canSell = true, onSelect, isSelected }) {
  const color     = TYPE_COLORS[creature.type] || '#5C3A1E';
  const icon      = TYPE_ICONS[creature.type]  || '?';
  const isBuyback = mode === 'buyback';
  const buyPrice  = isBuyback ? (creature.buybackPrice || creature.price) : creature.price;
  const canBuy    = (mode === 'buy' || isBuyback) && coins >= buyPrice;

  return (
    <div
      className={`pmc${isBuyback ? ' pmc--buyback' : ''}${isSelected ? ' pmc--selected' : ''}`}
      style={{ '--type-color': color }}
      onClick={onSelect ? () => onSelect(creature) : undefined}
    >
      {isBuyback && <div className="pmc-buyback-ribbon">💛 Previously Yours</div>}

      <div className="pmc-header">
        <span className="pmc-name">{creature.name}</span>
        <span className="pmc-type">{icon}</span>
      </div>

      {creature.image && (
        <div className="pmc-img-wrap">
          <img
            src={creature.image}
            alt={creature.name}
            className="pmc-img"
            style={{ objectPosition: `${creature.imagePosition?.x ?? 50}% ${creature.imagePosition?.y ?? 50}%` }}
            draggable={false}
          />
        </div>
      )}

      {(mode === 'buy' || isBuyback) && creature.level && (
        <div className="pmc-level-row">
          <span className="pmc-level-tag">LV {creature.level}</span>
          <span className="pmc-stars">{creature.stars}</span>
        </div>
      )}

      <div className="pmc-stats">
        <span>HP {creature.hp}</span>
        <span>ATK {creature.atk}</span>
        <span>DEF {creature.def}</span>
        <span>SPD {creature.spd}</span>
      </div>

      {(mode === 'buy' || isBuyback) && (
        <button
          className={`pmc-btn${canBuy ? '' : ' pmc-btn--disabled'}${isBuyback ? ' pmc-btn--buyback' : ''}`}
          onClick={e => { e.stopPropagation(); if (canBuy) onBuy(creature); }}
          disabled={!canBuy}
        >
          {buyPrice} 🪙 {isBuyback ? 'Buy Back' : 'Buy'}
        </button>
      )}
      {mode === 'sell' && (
        <button
          className={`pmc-btn pmc-btn--sell${!canSell ? ' pmc-btn--disabled' : ''}`}
          onClick={e => { e.stopPropagation(); if (canSell) onSell(creature); }}
          disabled={!canSell}
        >
          Sell · {Math.max(5, Math.floor(creature.hp / 5))} 🪙
        </button>
      )}
    </div>
  );
}

// ── NPC dialogue panel ────────────────────────────────────────────────────────

function NpcPanel({ npcId, lines, onClose, lastActions }) {
  const [lineIdx, setLineIdx] = useState(0);
  const { displayed, done, start, finish } = useTypewriter(22);

  useEffect(() => { start(lines[lineIdx]); }, [lineIdx]); // eslint-disable-line

  function advance() {
    if (!done) { finish(); return; }
    if (lineIdx < lines.length - 1) {
      setLineIdx(i => i + 1);
    } else {
      if (npcId === 'mystery') {
        localStorage.setItem(profileKey('mystery-met'), 'true');
      }
      onClose();
    }
  }

  const isLast = lineIdx === lines.length - 1 && done;

  return (
    <div className="parlor-npc-panel">
      <div className="parlor-npc-bubble" onClick={advance}>
        <p className="parlor-npc-text">
          {displayed}
          {!done && <span className="parlor-npc-cursor">▍</span>}
        </p>
      </div>
      <div className="parlor-npc-controls">
        <span className="parlor-npc-progress">{lineIdx + 1} / {lines.length}</span>
        {isLast && lastActions ? (
          <div className="parlor-npc-actions">
            {lastActions.map((a, i) => (
              <button key={i} className="parlor-npc-btn" onClick={a.onClick}>{a.label}</button>
            ))}
          </div>
        ) : (
          <button className="parlor-npc-btn" onClick={advance}>
            {isLast ? 'Farewell' : done ? 'Continue →' : 'Skip →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Mira's sell-confirmation dialog ──────────────────────────────────────────

function MiraSellDialog({ creature, offer, shelfFull, onConfirm, onCancel }) {
  return (
    <div className="mira-dialog-overlay">
      <div className="mira-dialog">

        <div className="mira-dialog-header">
          <div className="parlor-npc-avatar parlor-npc-avatar--sm">👩‍💼</div>
          <div className="mira-dialog-identity">
            <div className="parlor-npc-name">Mira Oakes</div>
            <div className="parlor-npc-role">Creature Merchant</div>
          </div>
        </div>

        <div className="mira-dialog-bubble">
          <p className="mira-dialog-line">{offer.line}</p>
        </div>

        {offer.isQuality && (
          <div className="mira-dialog-quality">✦ Rare specimen — quality bonus applied</div>
        )}
        {shelfFull && (
          <div className="mira-dialog-shelf-warn">
            ⚠ My shelf is full — selling this will pass an older one along to another buyer.
          </div>
        )}

        <div className="mira-dialog-offer">
          <span className="mira-dialog-creature">{creature.name}</span>
          <div className="mira-dialog-price">
            <span className="mira-dialog-price-label">Mira's Offer</span>
            <span className="mira-dialog-price-value">{offer.price} 🪙</span>
          </div>
        </div>

        <div className="mira-dialog-actions">
          <button className="mira-dialog-btn mira-dialog-btn--sell" onClick={onConfirm}>
            Sell It
          </button>
          <button className="mira-dialog-btn mira-dialog-btn--keep" onClick={onCancel}>
            Keep It
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Dev console flag list ─────────────────────────────────────────────────────

const ALL_DEV_FLAGS = [
  'lawyer-letter-delivered',
  'mira-bully-quest-available',
  'mira-bully-quest-started',
  'mira-bully-quest-complete',
  'genesis-received',
  'rekkon-received',
  'old-wren-appeared',
  'old-wren-page-delivered',
  'study-page-hidden',
  'ransack-triggered',
  'basement-discovered',
  'masked-man-defeated',
  'final-letter-delivered',
];

// ── Developer Console overlay ─────────────────────────────────────────────────
// Triggered by entering/exiting Scholar zone 5 times without visiting other zones.

function DevConsole({ onClose }) {
  const [battlesInput, setBattlesInput] = useState(() => String(getBattlesWon()));
  const [journalInput, setJournalInput] = useState(() => String(getJournalPages()));
  const [coinsInput,   setCoinsInput]   = useState(
    () => localStorage.getItem(profileKey('coins')) || '0'
  );
  const [flags,        setFlags]        = useState(
    () => Object.fromEntries(ALL_DEV_FLAGS.map(f => [f, getStoryFlag(f)]))
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [devToast,     setDevToast]     = useState(null);

  function showDevToast(msg) {
    setDevToast(msg);
    setTimeout(() => setDevToast(null), 2000);
  }

  function applyProgress() {
    const b = Math.max(0, parseInt(battlesInput, 10) || 0);
    const j = Math.max(1, Math.min(6, parseInt(journalInput, 10) || 1));
    const c = Math.max(0, parseInt(coinsInput, 10) || 0);
    localStorage.setItem(profileKey('battles-won'), String(b));
    setJournalPages(j);
    localStorage.setItem(profileKey('coins'), String(c));
    showDevToast('Progress applied!');
  }

  function toggleFlag(flagName) {
    const newVal = !flags[flagName];
    setStoryFlag(flagName, newVal);
    setFlags(f => ({ ...f, [flagName]: newVal }));
  }

  function triggerScenario(scenario) {
    const setBattles = (n) => {
      localStorage.setItem(profileKey('battles-won'), String(n));
      setBattlesInput(String(n));
    };
    const setFlag = (f) => { setStoryFlag(f, true); setFlags(p => ({ ...p, [f]: true })); };

    if (scenario === 'lawyer')       { setBattles(5); }
    if (scenario === 'mira-quest')   { setBattles(25); }
    if (scenario === 'mira-complete') {
      ['mira-bully-quest-available','mira-bully-quest-started','mira-bully-quest-complete'].forEach(setFlag);
    }
    if (scenario === 'wren') {
      setBattles(50);
      ['mira-bully-quest-available','mira-bully-quest-started','mira-bully-quest-complete'].forEach(setFlag);
    }
    if (scenario === 'ransack')       { setBattles(200); }
    if (scenario === 'journal-all')   { setJournalPages(6); setJournalInput('6'); }
    if (scenario === 'coins') {
      const cur  = parseInt(localStorage.getItem(profileKey('coins')) || '0', 10);
      const next = cur + 500;
      localStorage.setItem(profileKey('coins'), String(next));
      setCoinsInput(String(next));
    }
    if (scenario === 'mark-delivered') {
      ['lawyer-letter-delivered','old-wren-page-delivered','ransack-triggered',
       'masked-man-defeated','final-letter-delivered'].forEach(setFlag);
    }
    showDevToast('Done!');
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    resetAllProgress('CONFIRM');
    setBattlesInput('0');
    setJournalInput('1');
    setCoinsInput('0');
    setFlags(Object.fromEntries(ALL_DEV_FLAGS.map(f => [f, false])));
    setConfirmReset(false);
    showDevToast('All story progress reset.');
  }

  return (
    <div className="dev-overlay" role="dialog" aria-modal="true" aria-label="Developer Console">
      <div className="dev-panel">

        <div className="dev-header">
          <span className="dev-title">⚙️ Developer Console</span>
          <button className="dev-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {devToast && <div className="dev-toast">{devToast}</div>}

        {/* Section 1: Progress */}
        <div className="dev-section">
          <div className="dev-section-label">📊 Progress</div>
          <div className="dev-fields">
            <label className="dev-field">
              <span>Battles Won</span>
              <input
                type="number" min="0" value={battlesInput}
                onChange={e => setBattlesInput(e.target.value)}
                className="dev-input"
              />
            </label>
            <label className="dev-field">
              <span>Journal Pages (1–6)</span>
              <input
                type="number" min="1" max="6" value={journalInput}
                onChange={e => setJournalInput(e.target.value)}
                className="dev-input"
              />
            </label>
            <label className="dev-field">
              <span>Coins</span>
              <input
                type="number" min="0" value={coinsInput}
                onChange={e => setCoinsInput(e.target.value)}
                className="dev-input"
              />
            </label>
          </div>
          <button className="dev-btn" onClick={applyProgress}>Apply Changes</button>
        </div>

        {/* Section 2: Story Flags */}
        <div className="dev-section">
          <div className="dev-section-label">🚩 Story Flags</div>
          <div className="dev-flags">
            {ALL_DEV_FLAGS.map(f => (
              <button
                key={f}
                className={`dev-flag-btn${flags[f] ? ' dev-flag-btn--on' : ''}`}
                onClick={() => toggleFlag(f)}
              >
                <span className="dev-flag-dot">{flags[f] ? '✓' : '○'}</span>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Scenarios */}
        <div className="dev-section">
          <div className="dev-section-label">🎬 Scenarios</div>
          <div className="dev-scenarios">
            <button className="dev-btn dev-btn--scenario" onClick={() => triggerScenario('lawyer')}>
              Lawyer Letter threshold (5 wins)
            </button>
            <button className="dev-btn dev-btn--scenario" onClick={() => triggerScenario('mira-quest')}>
              Mira Quest threshold (25 wins)
            </button>
            <button className="dev-btn dev-btn--scenario" onClick={() => triggerScenario('mira-complete')}>
              Mark Mira Quest complete
            </button>
            <button className="dev-btn dev-btn--scenario" onClick={() => triggerScenario('wren')}>
              Old Wren threshold (50 wins + Mira done)
            </button>
            <button className="dev-btn dev-btn--scenario" onClick={() => triggerScenario('ransack')}>
              Ransack threshold (200 wins)
            </button>
            <button className="dev-btn dev-btn--scenario" onClick={() => triggerScenario('journal-all')}>
              Unlock all journal pages
            </button>
            <button className="dev-btn dev-btn--scenario" onClick={() => triggerScenario('coins')}>
              Add 500 coins
            </button>
            <button className="dev-btn dev-btn--scenario" onClick={() => triggerScenario('mark-delivered')}>
              Mark story events delivered
            </button>
          </div>
        </div>

        {/* Section 4: Dev Tools */}
        <div className="dev-section">
          <div className="dev-section-label">🔧 Dev Tools</div>
          <div className="dev-scenarios">

            <button className="dev-btn dev-btn--scenario" onClick={() => {
              try {
                const creature = {
                  id:       'dev-test-' + Date.now(),
                  name:     'TΞST UNIT',
                  type:     'iron',
                  hp: 200, currentHp: 200,
                  atk: 100, def: 100, spd: 100,
                  level: 10, xp: 0,
                  attacks: [
                    { name: 'Omega Strike', damage: 100, type: 'iron' },
                    { name: 'Debug Beam',   damage: 100, type: 'iron' },
                  ],
                  image: '',
                };
                const existing = JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]');
                localStorage.setItem(profileKey('creatures'), JSON.stringify([...existing, creature]));
                showDevToast('Test card spawned in collection!');
              } catch { showDevToast('Error spawning test card.'); }
            }}>
              ⚔️ Spawn Test Card
            </button>

            <button className="dev-btn dev-btn--scenario" onClick={() => {
              localStorage.removeItem(profileKey('mira-shop'));
              localStorage.removeItem(profileKey('mira-daily-sales'));
              showDevToast("Mira's shop reset — visit her for fresh stock.");
            }}>
              🪙 Reset Mira's Shop
            </button>

            <button className="dev-btn dev-btn--scenario" onClick={() => {
              localStorage.setItem(profileKey('tutorial-complete'), '');
              showDevToast('Tutorial reset — visit Manor Map to replay.');
            }}>
              📖 Reset Tutorial
            </button>

            <button className="dev-btn dev-btn--scenario" onClick={() => {
              localStorage.removeItem(profileKey('intro-seen'));
              showDevToast('Intro letter reset — visit Manor Map to replay.');
            }}>
              📜 Reset Intro Letter
            </button>

          </div>
        </div>

        {/* Section 5: Audio */}
        <div className="dev-section">
          <div className="dev-section-label">🔊 Audio</div>
          <div className="dev-audio-info">
            <span>Music: {Math.round(AudioManager.getMusicVolume() * 100)}%</span>
            <span>SFX: {Math.round(AudioManager.getSfxVolume() * 100)}%</span>
          </div>
          <div className="dev-scenarios">
            <button className="dev-btn dev-btn--scenario" onClick={() => {
              AudioManager.resetAudioSettings();
              showDevToast('Audio settings reset to defaults (50% music, 70% SFX).');
            }}>
              🔄 Reset Audio Settings
            </button>
            <button className="dev-btn dev-btn--scenario" onClick={() => {
              AudioManager.stopAll();
              showDevToast('All audio stopped.');
            }}>
              🔇 Stop All Audio
            </button>
          </div>
        </div>

        {/* Section 6: Danger Zone */}
        <div className="dev-section dev-section--danger">
          <div className="dev-section-label">⚠️ Danger Zone</div>
          <p className="dev-danger-note">
            Wipes all story progress for the active profile. Coins and creatures are kept.
          </p>
          {confirmReset ? (
            <div className="dev-danger-confirm">
              <span className="dev-danger-confirm-text">Are you sure? This cannot be undone.</span>
              <button className="dev-btn dev-btn--reset" onClick={handleReset}>
                Yes, Reset Everything
              </button>
              <button className="dev-btn dev-btn--cancel" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="dev-btn dev-btn--reset" onClick={handleReset}>
              Reset All Story Progress
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Mira bully quest dialogue ─────────────────────────────────────────────────

const MIRA_QUEST_LINES = [
  "I need to talk to you about something. Not business — something personal.",
  "There's a man in the village. Crogan. He's been shaking down the traders, scaring the children, breaking market stalls for sport.",
  "Nobody will stand up to him. He keeps Iron and Ember type creatures — big brutes, all muscle.",
  "But you… you've been winning in the Arena. Your creatures are strong. Would you face him for us?",
];

// ── Zone config ───────────────────────────────────────────────────────────────

const WREN_ZONE = {
  id: 'wren', icon: '🧓', label: 'Alcove III', npc: 'Old Wren',
  desc: 'A weathered farmhand nursing a drink. He seems to recognise you.',
  size: 'alcove',
};

const ZONES = [
  { id: 'bar',       icon: '🍺', label: 'The Bar',          npc: 'Elias Vance',       desc: 'Tips, rumours, and a warm drink',       size: 'normal' },
  { id: 'merchant',  icon: '🪙', label: "Mira's Corner",    npc: 'Mira Oakes',         desc: 'Buy and sell creatures for coins',       size: 'normal' },
  { id: 'scholar',   icon: '📚', label: "Scholar's Table",  npc: 'Prof. H. Bellway',  desc: 'Learn creature lore and type history',   size: 'normal' },
  { id: 'collector', icon: '🕯️', label: 'Alcove I',          npc: 'Sam the Collector', desc: 'A young collector eager to talk',         size: 'alcove' },
  { id: 'mystery',   icon: '🎭', label: 'Alcove II',         npc: '???',               desc: 'A cloaked figure sits alone in the dark', size: 'alcove' },
];

// ── Feedback modal ────────────────────────────────────────────────────────────

function FeedbackModal({ onClose }) {
  const [name,    setName]    = useState('');
  const [message, setMessage] = useState('');
  const [rating,  setRating]  = useState('');
  const [status,  setStatus]  = useState('idle'); // idle | sending | sent | error
  const profile = getActiveProfile();

  function handleSend() {
    if (!message.trim()) return;
    setStatus('sending');
    fetch('https://formspree.io/f/mbdbryay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name:       name.trim() || 'Anonymous visitor',
        message:    message.trim(),
        rating:     rating || 'No rating',
        profile:    profile?.name || 'Unknown',
        battlesWon: getBattlesWon(),
        creatures:  JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]').length,
      }),
    })
    .then(res => {
      if (res.ok) {
        localStorage.setItem(profileKey('last-feedback'), Date.now().toString());
        setStatus('sent');
      } else {
        setStatus('error');
      }
    })
    .catch(() => setStatus('error'));
  }

  if (status === 'sent') {
    return (
      <div className="feedback-overlay" onClick={onClose}>
        <div className="feedback-panel" onClick={e => e.stopPropagation()}>
          <span className="feedback-done-icon">✦</span>
          <h2 className="feedback-done-title">Thank You!</h2>
          <p className="feedback-done-text">Your note has been pinned to the board.</p>
          <button className="feedback-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-panel" onClick={e => e.stopPropagation()}>
        <h2 className="feedback-title">📝 Suggestion Box</h2>
        <p className="feedback-subtitle">Leave a note for the manor's keepers</p>
        <div className="feedback-divider">✦</div>

        <label className="feedback-label">Your Name <span className="feedback-opt">(optional)</span></label>
        <input className="feedback-input" value={name} onChange={e => setName(e.target.value)} placeholder="Anonymous visitor" />

        <label className="feedback-label">Your Note</label>
        <textarea className="feedback-textarea" value={message} onChange={e => setMessage(e.target.value)} placeholder="What do you think of the manor? Any suggestions, bugs, or ideas?" rows={4} />

        <label className="feedback-label">Enjoying the game? <span className="feedback-opt">(optional)</span></label>
        <div className="feedback-rating-row">
          {["🌟 Love it", "👍 It's good", "🔧 Needs work"].map(r => (
            <button key={r} type="button" className={`feedback-rating-btn${rating === r ? ' feedback-rating-btn--on' : ''}`} onClick={() => setRating(rating === r ? '' : r)}>
              {r}
            </button>
          ))}
        </div>

        {status === 'error' && <p className="feedback-error">The ink didn't take. Try again in a moment.</p>}

        <button className="feedback-send-btn" onClick={handleSend} disabled={!message.trim() || status === 'sending'}>
          {status === 'sending' ? 'Sending…' : '✦ Send Note'}
        </button>
        <button className="feedback-cancel-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Parlor page ───────────────────────────────────────────────────────────────

export default function Parlor() {
  const navigate = useNavigate();

  useEffect(() => {
    AudioManager.playMusic('/sounds/parlor-screen.mp3');
    return () => AudioManager.stopMusic();
  }, []);

  // Ctrl+Shift+D (or Cmd+Shift+D) toggles the dev console once unlocked
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDevConsole(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [activeZone,       setActiveZone]       = useState(null);
  const [showDevConsole,   setShowDevConsole]   = useState(false);
  const [showScholarModal, setShowScholarModal] = useState(false);
  const [scholarCipher,    setScholarCipher]    = useState('');
  const scholarTapCount = useRef(0);
  const [coins,       setCoins]       = useState(() => parseInt(localStorage.getItem(profileKey('coins')) || '0', 10));
  const [collection,  setCollection]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]'); }
    catch { return []; }
  });
  const [merchantTab,      setMerchantTab]      = useState('buy');
  const [miraQuestPhase,   setMiraQuestPhase]   = useState(null); // null | 'offer' | 'in-progress'
  const [toast,            setToast]            = useState(null);
  const [showFeedback,     setShowFeedback]     = useState(false);
  const [encouragementLine, setEncouragementLine] = useState(null);

  // Show an encouragement message from Elias every 4 wins (bracket milestone)
  useEffect(() => {
    const wins = getBattlesWon();
    if (wins < 4) return;
    const lastShown = Number(localStorage.getItem(profileKey('last-encourage-wins')) || '0');
    const bracket   = Math.floor(wins / 4) * 4;
    if (bracket <= lastShown) return;
    const pool = wins < 25  ? ENCOURAGEMENT_LINES.early
               : wins < 100 ? ENCOURAGEMENT_LINES.mid
               :               ENCOURAGEMENT_LINES.high;
    const last    = localStorage.getItem(profileKey('last-encourage-line')) || '';
    const options = pool.filter(l => l !== last);
    const line    = options[Math.floor(Math.random() * options.length)];
    localStorage.setItem(profileKey('last-encourage-wins'), String(bracket));
    localStorage.setItem(profileKey('last-encourage-line'), line);
    setEncouragementLine(line);
  }, []); // eslint-disable-line

  // Keep a ref to the latest collection so the stock-generation effect can
  // read it without needing collection in its dependency array (which would
  // cause unwanted regeneration every time the player buys something).
  const collectionRef = useRef(collection);
  useEffect(() => { collectionRef.current = collection; }, [collection]);

  // Mira's shop state
  const [miraShop,     setMiraShop]     = useState(() => loadMiraShop());
  const [dailySales,   setDailySales]   = useState(0);
  const [pendingSell,  setPendingSell]  = useState(null); // { creature, offer, shelfFull }
  const [miraQuip,     setMiraQuip]     = useState('');
  const [selectedCard, setSelectedCard] = useState(null); // card being inspected → Mira commentary
  const [, tick]                        = useState(0); // triggers countdown re-render

  const playerName  = getActiveProfile()?.name ?? 'friend';
  const playerTitle = getActiveProfile()?.title === 'niece' ? 'niece' : 'nephew';

  const [wrenStep, setWrenStep] = useState(null); // null | 0 (journal StoryLetter)

  // Quest badge shows on Mira's zone card whenever the quest is available but not yet finished
  const miraQuestActive = getBattlesWon() >= 25 && !getStoryFlag('mira-bully-quest-complete');

  const mysteryMet = localStorage.getItem(profileKey('mystery-met')) === 'true';

  // Old Wren: appears at 50 wins + Mira quest done; stays after delivery for follow-up dialogue
  const wrenConditions = getBattlesWon() >= 50
                      && getStoryFlag('mira-bully-quest-complete')
                      && !getStoryFlag('old-wren-page-delivered');
  const wrenDelivered  = getStoryFlag('old-wren-page-delivered');
  const showWren       = wrenConditions || wrenDelivered;

  const visibleAlcoves = [
    ...ZONES.filter(z => z.size === 'alcove'),
    ...(showWren ? [WREN_ZONE] : []),
  ];

  function completeWrenDelivery() {
    setStoryFlag('old-wren-appeared', true);
    setStoryFlag('old-wren-page-delivered', true);
    setJournalPages(4);
    setWrenStep(null);
    setActiveZone(null);
  }

  // Countdown tick — updates display every 60 s
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scholar zone 3-tap secret: tap Scholar 3 times in a row (no other zone between)
  // → show the Scholar's Note cipher modal. Returning to overview is neutral.
  useEffect(() => {
    if (activeZone === 'scholar') {
      scholarTapCount.current += 1;
      if (scholarTapCount.current >= 3) {
        setShowScholarModal(true);
        scholarTapCount.current = 0;
      }
    } else if (activeZone !== null) {
      scholarTapCount.current = 0;
    }
  }, [activeZone]); // eslint-disable-line

  // Load/generate Mira's shop each time the merchant zone is entered
  useEffect(() => {
    if (activeZone !== 'merchant') { setSelectedCard(null); setMiraQuestPhase(null); return; }

    // Check Mira bully quest conditions before loading the shop
    const battlesWon    = getBattlesWon();
    const questComplete = getStoryFlag('mira-bully-quest-complete');
    const questStarted  = getStoryFlag('mira-bully-quest-started');

    if (!questComplete && battlesWon >= 25) {
      if (!getStoryFlag('mira-bully-quest-available')) {
        setStoryFlag('mira-bully-quest-available', true);
      }
      setMiraQuestPhase(questStarted ? 'in-progress' : 'offer');
      return; // skip shop loading while quest dialogue is active
    }

    setMiraQuestPhase(null);
    setDailySales(loadDailySales());

    let shop = loadMiraShop();

    // Check if the restock timer has elapsed while away
    if (shop.inventory.length === 0 && shop.restockTime && Date.now() >= new Date(shop.restockTime).getTime()) {
      const freshInv = generateInventory(collectionRef.current, shop.lastBaseIds);
      shop = { ...shop, inventory: freshInv, restockTime: null, restocksToday: (shop.restocksToday || 0) + 1, lastBaseIds: freshInv.map(c => c.baseId) };
      saveMiraShop(shop);
      setMiraShop(shop);
      setMiraQuip(pick(MIRA_QUIPS.restock));
      return;
    }

    // First-ever visit OR no inventory and no timer — generate opening stock
    if (shop.inventory.length === 0 && !shop.restockTime) {
      const freshInv = generateInventory(collectionRef.current, shop.lastBaseIds);
      shop = { ...shop, inventory: freshInv, lastBaseIds: freshInv.map(c => c.baseId) };
      saveMiraShop(shop);
      setMiraShop(shop);
      setMiraQuip(pick(MIRA_QUIPS.fresh));
      return;
    }

    // Re-entering with existing inventory
    setMiraShop(shop);
    if (shop.inventory.length > 0 && shop.buyback.length > 0)  setMiraQuip(pick(MIRA_QUIPS.bothSides));
    else if (shop.inventory.length > 0)                        setMiraQuip(pick(shop.restocksToday > 0 ? MIRA_QUIPS.restock : MIRA_QUIPS.existing));
    else if (shop.buyback.length > 0)                          setMiraQuip(pick(MIRA_QUIPS.buybackOnly));
    else                                                        setMiraQuip(pick(MIRA_QUIPS.empty));
  }, [activeZone]); // eslint-disable-line

  // Computed restock countdown
  const msLeft    = miraShop.restockTime ? Math.max(0, new Date(miraShop.restockTime).getTime() - Date.now()) : 0;
  const timeLabel = msToLabel(msLeft);

  // Mira's active quip: commentary on selected card overrides the static quip
  const displayQuip = selectedCard ? getMiraCommentary(selectedCard) : miraQuip;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function saveCoins(c) {
    setCoins(c);
    localStorage.setItem(profileKey('coins'), String(c));
  }

  function saveCollection(col) {
    setCollection(col);
    localStorage.setItem(profileKey('creatures'), JSON.stringify(col));
  }

  function handleBuy(creature) {
    if (coins < creature.price) return;
    saveCoins(coins - creature.price);
    saveCollection([...collection, { ...creature, id: `bought-${Date.now()}` }]);
    if (selectedCard?.id === creature.id) setSelectedCard(null);

    const remaining = miraShop.inventory.filter(c => c.id !== creature.id);
    const restockTime = remaining.length === 0
      ? new Date(Date.now() + SHOP_RESTOCK_MS).toISOString() // all bought → start timer
      : miraShop.restockTime;
    const updatedShop = { ...miraShop, inventory: remaining, restockTime };
    saveMiraShop(updatedShop);
    setMiraShop(updatedShop);

    if (remaining.length === 0) setMiraQuip(pick(MIRA_QUIPS.empty));
    showToast(`${creature.name} joined your collection!`);
  }

  function handleBuyback(creature) {
    const price = creature.buybackPrice || creature.price;
    if (coins < price) return;
    saveCoins(coins - price);
    saveCollection([...collection, { ...creature, id: `bought-back-${Date.now()}`, buybackPrice: undefined }]);
    if (selectedCard?.id === creature.id) setSelectedCard(null);

    const updatedBuyback = miraShop.buyback.filter(c => c.id !== creature.id);
    const updatedShop = { ...miraShop, buyback: updatedBuyback };
    saveMiraShop(updatedShop);
    setMiraShop(updatedShop);
    showToast(`${creature.name} is back with you!`);
  }

  function handleSellRequest(creature) {
    const offer     = getMiraOffer(creature, dailySales, playerName);
    const shelfFull = miraShop.buyback.length >= BUYBACK_LIMIT;
    setPendingSell({ creature, offer, shelfFull });
  }

  function handleSellConfirm() {
    if (!pendingSell || pendingSell.offer.closed) { setPendingSell(null); return; }
    const { creature, offer } = pendingSell;
    const newCount = dailySales + 1;
    saveCoins(coins + offer.price);
    saveCollection(collection.filter(c => c.id !== creature.id));
    setDailySales(newCount);
    saveDailySales(newCount);

    // Add sold creature to buyback shelf (most-recent-first), keep within limit
    const buybackEntry = { ...creature, buybackPrice: Math.ceil(offer.price * 1.5) };
    const updatedBuyback = [buybackEntry, ...miraShop.buyback].slice(0, BUYBACK_LIMIT);
    const updatedShop = { ...miraShop, buyback: updatedBuyback };
    saveMiraShop(updatedShop);
    setMiraShop(updatedShop);

    setPendingSell(null);
    showToast(`Sold ${creature.name} for ${offer.price} 🪙`);
  }

  function handleSellCancel() { setPendingSell(null); }

  // ── Mira bully quest handlers ─────────────────────────────────────────────

  function handleMiraQuestAccept() {
    setStoryFlag('mira-bully-quest-started', true);
    navigate('/crogan-battle');
  }

  function handleMiraQuestDecline() {
    setMiraQuestPhase(null);
    setActiveZone(null);
  }

  function handleScholarSubmit() {
    if (scholarCipher.trim().toLowerCase() === 'gripe') {
      setShowDevConsole(true);
    }
    setShowScholarModal(false);
    setScholarCipher('');
  }

  return (
    <div className="parlor-page">

      {/* ── Header ── */}
      <header className="parlor-header">
        <button
          className="parlor-back-btn"
          onClick={() => activeZone ? setActiveZone(null) : navigate('/manor')}
        >
          {activeZone ? '← Parlour' : '← Manor'}
        </button>
        <div className="parlor-title-group">
          <span>🍺</span>
          <h1 className="parlor-title">The Parlour</h1>
        </div>
        <div className="parlor-coins">🪙 {coins}</div>
      </header>

      {/* ══════════════════ OVERVIEW ══════════════════ */}
      {!activeZone && (
        <main className="parlor-main parlor-fade">

          <div className="parlor-notice-board">
            <div className="parlor-notice-label">📋 Notice Board</div>
            <div className="parlor-notice-scroll">
              {NOTICE_BOARD.map((note, i) => (
                <span key={i} className="parlor-notice-pin">{note}</span>
              ))}
            </div>
          </div>

          {encouragementLine && (
            <div className="parlor-encouragement">
              <span className="parlor-encourage-icon">⭐</span>
              <p className="parlor-encourage-text">
                <strong>Elias leans over the bar:</strong> "{encouragementLine}"
              </p>
              <button
                className="parlor-encourage-dismiss"
                onClick={() => setEncouragementLine(null)}
              >
                ✕
              </button>
            </div>
          )}

          {(() => {
            const lastFeedback = Number(localStorage.getItem(profileKey('last-feedback')) || '0');
            const feedbackCooldown = Date.now() - lastFeedback < 10 * 60 * 1000;
            return (
              <button
                className="parlor-feedback-btn"
                onClick={() => setShowFeedback(true)}
                disabled={feedbackCooldown}
              >
                {feedbackCooldown ? 'You recently left a note' : '📝 Leave a Note'}
              </button>
            );
          })()}

          <p className="parlor-tagline">
            Warm candlelight. The smell of old wood and something brewing. Find a seat.
          </p>

          <div className="parlor-zone-row parlor-zone-row--top">
            {ZONES.filter(z => z.size === 'normal').map(z => (
              <button key={z.id} className="parlor-zone-card" onClick={() => setActiveZone(z.id)}>
                <span className="pzc-icon">{z.icon}</span>
                <span className="pzc-label">{z.label}</span>
                <span className="pzc-npc">{z.npc}</span>
                <span className="pzc-desc">{z.desc}</span>
                {z.id === 'merchant' && miraQuestActive && (
                  <span className="pzc-quest-badge" aria-label="Quest available">❗</span>
                )}
              </button>
            ))}
          </div>

          <div className="parlor-zone-row parlor-zone-row--alcoves">
            {visibleAlcoves.map(z => {
              const isEmpty     = z.id === 'mystery' && mysteryMet;
              const hasIndicator = z.id === 'wren' && wrenConditions;
              return (
                <button
                  key={z.id}
                  className={`parlor-zone-card parlor-zone-card--alcove${isEmpty ? ' parlor-zone-card--empty' : ''}`}
                  onClick={() => { if (!isEmpty) setActiveZone(z.id); }}
                >
                  <span className="pzc-icon">{isEmpty ? '🕯️' : z.icon}</span>
                  <span className="pzc-label">{isEmpty ? 'Alcove II' : z.label}</span>
                  <span className="pzc-npc">{isEmpty ? 'Empty' : z.npc}</span>
                  <span className="pzc-desc">
                    {isEmpty
                      ? 'The alcove sits empty. A faint smell of pipe smoke lingers.'
                      : z.desc}
                  </span>
                  {hasIndicator && (
                    <span className="pzc-quest-badge" aria-label="Has something for you">❗</span>
                  )}
                </button>
              );
            })}
          </div>

        </main>
      )}

      {/* ══════════════════ THE BAR ══════════════════ */}
      {activeZone === 'bar' && (
        <div className="parlor-zone-view parlor-zone-view--bar parlor-fade">
          <div className="parlor-scene">
            <div className="parlor-bar-counter">
              <div className="parlor-bar-bottles">
                {['🍶','🫙','🍵','🫗','🍶','🫙'].map((b, i) => (
                  <span key={i} className="parlor-bottle">{b}</span>
                ))}
              </div>
              <div className="parlor-bar-plank" />
            </div>
            <div className="parlor-npc-figure">
              <div className="parlor-npc-avatar">🧔</div>
              <div className="parlor-npc-name">Elias Vance</div>
              <div className="parlor-npc-role">Barkeep</div>
            </div>
          </div>
          <NpcPanel npcId="barkeep" lines={getNpcLines('barkeep')} onClose={() => setActiveZone(null)} />
        </div>
      )}

      {/* ══════════════════ MERCHANT ══════════════════ */}
      {activeZone === 'merchant' && (
        <div className="parlor-zone-view parlor-fade">

          {/* ── Quest: offer phase ── */}
          {miraQuestPhase === 'offer' && (
            <>
              <div className="parlor-merchant-top">
                <div className="parlor-npc-avatar parlor-npc-avatar--sm">👩‍💼</div>
                <div className="parlor-merchant-info">
                  <div className="parlor-npc-name">Mira Oakes</div>
                  <div className="parlor-npc-role">Creature Merchant</div>
                  <div className="parlor-mira-quip parlor-mira-quip--quest">
                    ❗ She has something important to tell you.
                  </div>
                </div>
              </div>
              <NpcPanel
                npcId="mira-quest-offer"
                lines={MIRA_QUEST_LINES}
                onClose={handleMiraQuestDecline}
                lastActions={[
                  { label: "I'll face him", onClick: handleMiraQuestAccept },
                  { label: 'Not yet',        onClick: handleMiraQuestDecline },
                ]}
              />
            </>
          )}

          {/* ── Quest: in-progress reminder ── */}
          {miraQuestPhase === 'in-progress' && (
            <>
              <div className="parlor-merchant-top">
                <div className="parlor-npc-avatar parlor-npc-avatar--sm">👩‍💼</div>
                <div className="parlor-merchant-info">
                  <div className="parlor-npc-name">Mira Oakes</div>
                  <div className="parlor-npc-role">Creature Merchant</div>
                </div>
              </div>
              <NpcPanel
                npcId="mira-quest-reminder"
                lines={["Crogan is still out there. Please — when you're ready, face him."]}
                onClose={() => setActiveZone(null)}
                lastActions={[
                  { label: 'Face Crogan →', onClick: () => navigate('/crogan-battle') },
                  { label: 'Not yet',        onClick: () => setActiveZone(null) },
                ]}
              />
            </>
          )}

          {/* ── Normal merchant shop (quest not active or already complete) ── */}
          {!miraQuestPhase && (<>

          {/* Mira header */}
          <div className="parlor-merchant-top">
            <div className="parlor-npc-avatar parlor-npc-avatar--sm">👩‍💼</div>
            <div className="parlor-merchant-info">
              <div className="parlor-npc-name">Mira Oakes</div>
              <div className="parlor-npc-role">Creature Merchant</div>
              {displayQuip && <div className={`parlor-mira-quip${selectedCard ? ' parlor-mira-quip--commentary' : ''}`}>{displayQuip}</div>}
            </div>
          </div>

          <div className="parlor-tabs">
            <button className={`parlor-tab${merchantTab === 'buy'  ? ' parlor-tab--on' : ''}`} onClick={() => setMerchantTab('buy')}>Shop</button>
            <button className={`parlor-tab${merchantTab === 'sell' ? ' parlor-tab--on' : ''}`} onClick={() => setMerchantTab('sell')}>Sell</button>
          </div>

          {/* ── SHOP TAB: Mira's Finds + Your Old Friends ── */}
          {merchantTab === 'buy' && (
            <div className="mira-shop-layout">

              {/* LEFT SECTION — Mira's Finds (restocking inventory) */}
              <div className="mira-shop-section">
                <div className="mira-section-header">
                  <span className="mira-section-title">🪙 Mira's Finds</span>
                </div>

                {miraShop.inventory.length === 0 ? (
                  /* Gone to Market state */
                  <div className="mira-empty-table">
                    <div className="mira-gone-sign">
                      <span className="mira-gone-icon">🕐</span>
                      <p className="mira-gone-text">Gone to market!</p>
                      <p className="mira-gone-sub">Back soon.</p>
                      {timeLabel
                        ? <div className="mira-restock-countdown">Mira returns in: <strong>{timeLabel}</strong></div>
                        : <div className="mira-restock-countdown">Mira is on her way back…</div>
                      }
                    </div>
                  </div>
                ) : (
                  <div className="parlor-card-grid">
                    {miraShop.inventory.map(c => (
                      <MiniCard
                        key={c.id}
                        creature={c}
                        mode="buy"
                        coins={coins}
                        onBuy={handleBuy}
                        onSelect={setSelectedCard}
                        isSelected={selectedCard?.id === c.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT SECTION — Your Old Friends (buyback shelf) — only when non-empty */}
              {miraShop.buyback.length > 0 && (
                <>
                <div className="mira-shelf-divider" aria-hidden />
                <div className="mira-shop-section mira-shop-section--buyback">
                  <div className="mira-section-header">
                    <span className="mira-section-title">💛 Your Old Friends</span>
                    <span className="mira-section-note">{miraShop.buyback.length}/{BUYBACK_LIMIT} kept</span>
                  </div>
                  <div className="parlor-card-grid">
                    {miraShop.buyback.map(c => (
                      <MiniCard
                        key={c.id}
                        creature={c}
                        mode="buyback"
                        coins={coins}
                        onBuy={handleBuyback}
                        onSelect={setSelectedCard}
                        isSelected={selectedCard?.id === c.id}
                      />
                    ))}
                  </div>
                </div>
                </>
              )}

            </div>
          )}

          {merchantTab === 'sell' && (
            <>
              {/* Mira's daily capacity banner */}
              {dailySales >= MIRA_MAX_DAILY ? (
                <div className="parlor-sell-cap parlor-sell-cap--full">
                  <span className="parlor-sell-cap-icon">🪙</span>
                  <span>
                    <strong>Mira's coin purse is empty for today.</strong>{' '}
                    Come back tomorrow for fresh trades.
                  </span>
                </div>
              ) : (
                <div className="parlor-sell-cap">
                  <span className="parlor-sell-cap-icon">🪙</span>
                  <span>
                    Mira will buy up to{' '}
                    <strong>{MIRA_MAX_DAILY - dailySales} more card{MIRA_MAX_DAILY - dailySales !== 1 ? 's' : ''}</strong>
                    {' '}today. Price drops a little with each sale.
                  </span>
                </div>
              )}

              <div className="parlor-card-grid">
                {collection.length === 0
                  ? <p className="parlor-empty">Your collection is empty — nothing to sell.</p>
                  : collection.map(c => (
                      <MiniCard
                        key={c.id}
                        creature={c}
                        mode="sell"
                        onSell={handleSellRequest}
                        canSell={dailySales < MIRA_MAX_DAILY}
                      />
                    ))
                }
              </div>
            </>
          )}

          </>)} {/* end !miraQuestPhase */}
        </div>
      )}

      {/* ══════════════════ SCHOLAR ══════════════════ */}
      {activeZone === 'scholar' && (
        <div className="parlor-zone-view parlor-fade">
          <div className="parlor-scene">
            <div className="parlor-scholar-books">
              {['📘','📗','📕','📙','📘'].map((b, i) => (
                <span key={i} style={{ fontSize: '2rem', opacity: 0.8 }}>{b}</span>
              ))}
            </div>
            <div className="parlor-npc-figure">
              <div className="parlor-npc-avatar">👴</div>
              <div className="parlor-npc-name">Prof. H. Bellway</div>
              <div className="parlor-npc-role">Natural Historian</div>
            </div>
          </div>
          <NpcPanel npcId="scholar" lines={getNpcLines('scholar')} onClose={() => setActiveZone(null)} />
        </div>
      )}

      {/* ══════════════════ COLLECTOR ALCOVE ══════════════════ */}
      {activeZone === 'collector' && (
        <div className="parlor-zone-view parlor-zone-view--alcove parlor-fade">
          <div className="parlor-scene parlor-scene--alcove">
            <span className="parlor-alcove-candle">🕯️</span>
            <div className="parlor-npc-figure">
              <div className="parlor-npc-avatar">🧒</div>
              <div className="parlor-npc-name">Sam</div>
              <div className="parlor-npc-role">Young Collector</div>
            </div>
          </div>
          <NpcPanel npcId="collector" lines={getNpcLines('collector', playerTitle)} onClose={() => setActiveZone(null)} />
        </div>
      )}

      {/* ══════════════════ MYSTERY ALCOVE ══════════════════ */}
      {activeZone === 'mystery' && (
        <div className="parlor-zone-view parlor-zone-view--mystery parlor-fade">
          <div className="parlor-scene parlor-scene--alcove parlor-scene--mystery">
            <div className="parlor-mystery-glow" aria-hidden />
            <div className="parlor-npc-figure">
              <div className="parlor-npc-avatar parlor-npc-avatar--mystery">🎭</div>
              <div className="parlor-npc-name">???</div>
              <div className="parlor-npc-role">Unknown</div>
            </div>
          </div>
          <NpcPanel npcId="mystery" lines={NPC_LINES.mystery} onClose={() => setActiveZone(null)} />
        </div>
      )}

      {/* ══════════════════ OLD WREN ALCOVE ══════════════════ */}
      {activeZone === 'wren' && (
        <div className="parlor-zone-view parlor-zone-view--alcove parlor-fade">
          <div className="parlor-scene parlor-scene--alcove">
            <span className="parlor-alcove-candle">🕯️</span>
            <div className="parlor-npc-figure">
              <div className="parlor-npc-avatar">🧓</div>
              <div className="parlor-npc-name">Old Wren</div>
              <div className="parlor-npc-role">Former Groundskeeper</div>
            </div>
          </div>
          {!wrenDelivered ? (
            <NpcPanel
              npcId="wren"
              lines={NPC_LINES.wren}
              onClose={() => setActiveZone(null)}
              lastActions={[{ label: 'Take the page →', onClick: () => setWrenStep(0) }]}
            />
          ) : (
            <NpcPanel
              npcId="wrenAfter"
              lines={NPC_LINES.wrenAfter}
              onClose={() => setActiveZone(null)}
            />
          )}
        </div>
      )}

      {/* ── Wren journal page delivery ── */}
      <StoryLetter
        visible={wrenStep === 0}
        type="journal"
        icon="✦"
        title="Argon's Journal — Day 1,204"
        subtitle="A Growing Unease"
        paragraphs={[
          "My colleague visited again today. He is brilliant — I have never denied this. His understanding of elemental theory surpasses even Caldwell's.",
          "But he speaks of the creatures as instruments. As weapons to be refined. He asked about the source again — where they truly come from. I told him I did not know.",
          "This was not entirely true.",
          "I have begun to lock my study at night.",
          "— A.",
        ]}
        buttonText="Add to Journal"
        onClose={completeWrenDelivery}
      />

      {/* Mira's sell confirmation dialog */}
      {pendingSell && (
        <MiraSellDialog
          creature={pendingSell.creature}
          offer={pendingSell.offer}
          onConfirm={handleSellConfirm}
          onCancel={handleSellCancel}
        />
      )}

      {/* Toast */}
      {toast && <div className="parlor-toast">{toast}</div>}

      {/* Scholar's Note — cipher modal (3-tap Scholar trigger) */}
      {showScholarModal && (
        <div className="scholar-note-overlay" onClick={() => { setShowScholarModal(false); setScholarCipher(''); }}>
          <div className="scholar-note-panel" onClick={e => e.stopPropagation()}>
            <h3 className="scholar-note-title">Scholar's Note</h3>
            <p className="scholar-note-flavour">
              The Professor slides a folded note across the table and taps it twice with one finger.
            </p>
            <input
              className="scholar-note-input"
              type="text"
              placeholder="Enter the cipher…"
              value={scholarCipher}
              onChange={e => setScholarCipher(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleScholarSubmit(); }}
              autoFocus
            />
            <button className="scholar-note-submit" onClick={handleScholarSubmit}>
              Submit
            </button>
          </div>
        </div>
      )}

      {/* Developer Console */}
      {showDevConsole && (
        <DevConsole onClose={() => setShowDevConsole(false)} />
      )}

      {/* Suggestion Box */}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

    </div>
  );
}
