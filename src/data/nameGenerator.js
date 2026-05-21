// Victorian naturalist creature names and attack names, themed by element type.
// All names are meant to sound like entries in Uncle Argon's specimen journals.

const TYPE_NAMES = {
  ember: {
    creatures: [
      'Cinderscale', 'Blazefang', 'Ashmantle', 'Scorchtail', 'Emberclaw',
      'Flameback',   'Charspine', 'Ignithorn',  'Burnmaw',   'Pyre-Drake',
      'Smoulderback','Hearthfang','Ashcoil',    'Cinders',   'Scorchback',
    ],
    attacks: [
      'Cinder Blast',   'Ember Surge',     'Scorching Lunge', 'Ash Cloud',
      'Flame Fang',     'Blaze Rush',      'Char Strike',     'Searing Breath',
      'Burning Dash',   'Fireback Coil',   'Ignite',          'Smoulder Burst',
      'Cinder Storm',   'Forge Breath',    'Ashfall',
    ],
  },

  tide: {
    creatures: [
      'Brinefin',   'Kelphide',    'Surgescale', 'Driftback',  'Foamcrest',
      'Tidemaw',    'Saltspine',   'Crestfin',   'Shallowdart','Deepwader',
      'Brackenhide','Waveback',    'Murkmaw',    'Reedscale',  'Mistgill',
    ],
    attacks: [
      'Crashing Wave',  'Brine Spit',    'Deep Surge',    'Kelp Bind',
      'Undertow',       'Tidal Rush',    'Foam Burst',    'Riptide Slash',
      'Saltwater Sting','Whirlpool Grasp','Surf Strike',  'Drift Coil',
      'Abyssal Lunge',  'Current Snap',  'Sea Mist',
    ],
  },

  thorn: {
    creatures: [
      'Bramblefox', 'Briarspine', 'Mossback',  'Fernscale',  'Thornhide',
      'Nettleclaw', 'Lichenmaw', 'Ivyback',   'Sporemantle','Rootfang',
      'Boughspine', 'Vinecoil',  'Burrhide',  'Thistleback','Pricklemaw',
    ],
    attacks: [
      'Vine Lash',     'Bramble Surge',  'Spore Cloud',  'Root Bind',
      'Nettle Sting',  'Thorn Barrage',  'Briar Wrap',   'Leaf Blade',
      "Nature's Grasp",'Overgrowth',    'Bark Slam',    'Seedburst',
      'Creeping Coil', 'Thicket Dash',  'Pollen Burst',
    ],
  },

  storm: {
    creatures: [
      'Galewing',    'Squallback',  'Zephyrclaw', 'Nimbusfin',   'Boltscale',
      'Tempestmane', 'Driftfang',  'Gustspine',  'Sparkhide',   'Thundertail',
      'Cycloneback', 'Stormfin',   'Flashback',  'Staticscale', 'Cloudmaw',
    ],
    attacks: [
      'Thunder Clap',  'Lightning Dash', 'Gale Slash',  'Static Burst',
      'Bolt Strike',   'Gust Barrage',   'Storm Rush',  'Cyclone Spin',
      'Spark Strike',  'Thunder Roll',   'Squall Lunge','Nimbus Coil',
      'Whirlwind',     'Arc Flash',      'Tempest Drive',
    ],
  },

  phantom: {
    creatures: [
      'Shadowveil', 'Wispform',   'Duskwalker', 'Gloomshade',  'Mirkdrift',
      'Shroudwraith','Veilhide',  'Specterback','Dimspine',    'Hollowmaw',
      'Nightmantle','Fadeback',   'Pallormaw',  'Murkveil',    'Shade-Creep',
    ],
    attacks: [
      'Shadow Grasp',  'Wisp Drain',    'Dusk Shroud',    'Spectral Lunge',
      'Void Touch',    'Haunt',         'Dark Mist',      'Soul Sap',
      'Phantom Strike','Gloom Wave',    'Shade Coil',     'Nightfall Rush',
      'Hollow Wail',   'Umbra Lash',    'Fade Strike',
    ],
  },

  iron: {
    creatures: [
      'Stoneback',  'Forgescale', 'Cobaltspine', 'Gravelhide',  'Ironclad',
      'Cragshell',  'Orehide',   'Slagback',    'Boulderscale','Flintmaw',
      'Hammerback', 'Anvilspine','Steelcrest',  'Gritscale',   'Lodeback',
    ],
    attacks: [
      'Iron Slam',    'Stone Crush',   'Ore Bash',     'Forge Strike',
      'Gravel Spray', 'Boulder Drop',  'Plated Charge','Metal Claw',
      'Slag Toss',    'Iron Guard',    'Crag Smash',   'Rivet Strike',
      'Granite Lunge','Tempered Bite', 'Anvil Drop',
    ],
  },
};

// Pick a random item from an array
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Returns one random creature name for the given type
export function generateCreatureName(type) {
  const data = TYPE_NAMES[type] || TYPE_NAMES.iron;
  return pick(data.creatures);
}

// Returns one random attack name for the given type
export function generateAttackName(type) {
  const data = TYPE_NAMES[type] || TYPE_NAMES.iron;
  return pick(data.attacks);
}

// Returns two distinct random attack names for the given type
export function generateAttackNames(type) {
  const data = TYPE_NAMES[type] || TYPE_NAMES.iron;
  const pool = [...data.attacks];
  // Remove and return the first pick, then pick from the remainder
  const firstIndex = Math.floor(Math.random() * pool.length);
  const [first] = pool.splice(firstIndex, 1);
  const second = pick(pool);
  return [first, second];
}
