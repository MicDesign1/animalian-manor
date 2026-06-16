export function getMultiplier(attackType, defenderType, defenderDualType = null) {
  function singleMult(aType, dType) {
    // FIX 1: Phantom is a glass cannon — deals 1.25x AND takes 1.25x (was 0.75 on defense).
    if (dType === 'phantom') return 1.25;
    if (aType === 'phantom') return 1.25;
    if (aType === 'iron')    return 1.0;
    const chart = {
      ember: { strong: 'thorn', weak: 'tide'  },
      tide:  { strong: 'ember', weak: 'storm' },
      thorn: { strong: 'tide',  weak: 'ember' },
      storm: { strong: 'tide',  weak: 'thorn' },
    };
    const row = chart[aType];
    if (!row) return 1.0;
    if (row.strong === dType) return 1.5;
    if (row.weak   === dType) return 0.75;
    return 1.0;
  }
  const primaryMult = singleMult(attackType, defenderType);
  if (!defenderDualType) return primaryMult;
  return Math.min(primaryMult, singleMult(attackType, defenderDualType));
}

export function calcDamage(attacker, attack, defender) {
  const base = Math.max(5, attack.damage + Math.floor((attacker.atk - defender.def) / 2));
  return Math.round(base * getMultiplier(attack.type ?? attacker.type, defender.type, defender.dualType));
}

// FIX 2: An attack is "strong" if its damage equals the higher of the two attacks.
// On a tie, BOTH attacks count as strong, closing the exploit where two equal-damage
// attacks dodged cooldowns entirely.
export function isStrongAttack(attacks, idx) {
  if (!attacks || attacks.length < 2) return false;
  const maxDmg = Math.max(attacks[0].damage, attacks[1].damage);
  return attacks[idx].damage === maxDmg;
}

export function rollInitiative(playerSpeed, enemySpeed) {
  const d20 = () => Math.floor(Math.random() * 20) + 1;
  const mod = s => Math.round((s || 0) / 10); // SPD 10–100 -> +1..+10; d20 stays dominant so upsets are common
  const pMod = mod(playerSpeed), eMod = mod(enemySpeed);
  let pRoll, eRoll, pTotal, eTotal;
  do {
    pRoll = d20(); eRoll = d20();
    pTotal = pRoll + pMod; eTotal = eRoll + eMod;
  } while (pTotal === eTotal); // re-roll exact ties, D&D-style
  return { playerFirst: pTotal > eTotal, pRoll, eRoll, pMod, eMod, pTotal, eTotal };
}

export function initiativeText(playerName, enemyName, r) {
  return `🎲 Initiative — ${playerName}: ${r.pRoll}+${r.pMod}=${r.pTotal}  vs  ${enemyName}: ${r.eRoll}+${r.eMod}=${r.eTotal}`;
}

// Groundshaking Attack — only legendary creatures can trigger this.
// 20% chance per strike to deal 1.5× the normal damage.
// Returns { triggered: boolean } — the caller applies the multiplier and visual effects.
export function rollGroundshaking(attacker) {
  if (!attacker.isLegendary) return { triggered: false };
  return { triggered: Math.random() < 0.20 };
}

// Enemy AI: choose the attack that deals the most damage to the current defender.
// 80% of the time it picks the optimal attack; 20% it picks randomly, so it still
// feels like an opponent and not a solver. Returns one attack object.
export function chooseBestAttack(attacker, defender) {
  const attacks = attacker.attacks || [];
  if (attacks.length === 0) return null;
  if (attacks.length === 1) return attacks[0];

  if (Math.random() < 0.2) {
    return attacks[Math.floor(Math.random() * attacks.length)];
  }
  let best = attacks[0];
  let bestDmg = calcDamage(attacker, attacks[0], defender);
  for (let i = 1; i < attacks.length; i++) {
    const dmg = calcDamage(attacker, attacks[i], defender);
    if (dmg > bestDmg) { best = attacks[i]; bestDmg = dmg; }
  }
  return best;
}

// Deadlock guard — cooldowns are tracked as a per-slot array parallel to a
// creature's attacks (e.g. b.current.cooldowns / playerCooldowns: [0, 0]).
// If both slots land on cooldown at the same time (common when two attacks
// share the same cooldown value), there would be no selectable move and the
// turn could never resolve. Call this right before attacks are presented for
// selection / before the turn resolves. If at least one attack is already
// available, the array is returned untouched. Otherwise the attack with the
// lowest remaining cooldown is freed (ties go to the first attack), so there
// is always at least one playable move.
export function ensurePlayableAttack(cooldowns) {
  if (!cooldowns || cooldowns.length === 0) return cooldowns;
  if (cooldowns.some(cd => cd <= 0)) return cooldowns;

  let lowestIdx = 0;
  for (let i = 1; i < cooldowns.length; i++) {
    if (cooldowns[i] < cooldowns[lowestIdx]) lowestIdx = i;
  }
  const fixed = [...cooldowns];
  fixed[lowestIdx] = 0;
  return fixed;
}
