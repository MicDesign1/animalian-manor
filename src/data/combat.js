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
  const base = Math.max(5, attack.damage + Math.floor((attacker.atk - defender.def) / 4));
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
