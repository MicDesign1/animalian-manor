import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatureCard from '../components/CreatureCard';
import { profileKey } from '../data/profiles';
import { incrementBattlesWon, checkMilestones } from '../data/gameProgress';
import { getRandomImage } from '../data/creatureImages';
import { isReservedArt } from '../data/reservedArt';
import AudioManager from '../audio/AudioManager';
import './Arena.css';

// ── Pre-made challengers from the manor ──────────────────────────────────────
const CHALLENGERS = [
  { id:'e1', name:'Manor Hound',    type:'iron',    hp:120, atk:55, def:45, spd:55,
    attacks:[{name:'Steel Bite',   damage:30,type:'iron'},   {name:'Iron Tackle',  damage:40,type:'iron'}]   },
  { id:'e2', name:'Garden Sprite',  type:'thorn',   hp:90,  atk:65, def:35, spd:75,
    attacks:[{name:'Petal Slash',  damage:25,type:'thorn'},  {name:'Root Bind',    damage:45,type:'thorn'}]  },
  { id:'e3', name:'Storm Wren',     type:'storm',   hp:85,  atk:75, def:25, spd:90,
    attacks:[{name:'Gale Wing',    damage:20,type:'storm'},  {name:'Bolt Screech', damage:50,type:'storm'}]  },
  { id:'e4', name:'Tideserpent',    type:'tide',    hp:150, atk:45, def:80, spd:40,
    attacks:[{name:'Brine Wrap',   damage:30,type:'tide'},   {name:'Deep Surge',   damage:45,type:'tide'}]   },
  { id:'e5', name:'Ashviper',       type:'ember',   hp:110, atk:70, def:40, spd:65,
    attacks:[{name:'Venom Flame',  damage:35,type:'ember'},  {name:'Cinder Coil',  damage:45,type:'ember'}]  },
  { id:'e6', name:'Shade Moth',     type:'phantom', hp:100, atk:65, def:30, spd:80,
    attacks:[{name:'Dusk Powder',  damage:25,type:'phantom'},{name:'Night Veil',   damage:45,type:'phantom'}]},
];

// ── Difficulty settings ───────────────────────────────────────────────────────
// statMult scales all enemy stats; coinMult rewards more coins for harder runs.
const DIFFICULTY = {
  easy:   { id: 'easy',   icon: '🌿', label: 'Easy',   statMult: 0.68, teamSize: 2, coinMult: 1.0,
             desc: 'A gentle introduction' },
  medium: { id: 'medium', icon: '⚔️',  label: 'Medium', statMult: 1.00, teamSize: 3, coinMult: 1.5,
             desc: 'A proper challenge' },
  hard:   { id: 'hard',   icon: '💀', label: 'Hard',   statMult: 1.40, teamSize: 4, coinMult: 2.5,
             desc: 'Fierce manor warriors' },
};

// Returns a copy of a challenger with stats scaled by mult and a random image assigned.
function scaledChallenger(c, mult) {
  const s = Math.max.bind(null);
  const r = v => Math.round(v * mult);
  // Safety assertion: reserved art must never appear on an arena challenger.
  const img = getRandomImage();
  return {
    ...c,
    hp:      s(50,  r(c.hp)),
    atk:     s(10,  r(c.atk)),
    def:     s(10,  r(c.def)),
    spd:     s(10,  r(c.spd)),
    attacks: c.attacks.map(a => ({ ...a, damage: s(5, r(a.damage)) })),
    image:   isReservedArt(img) ? getRandomImage() : img,
  };
}

// ── Type advantage chart ─────────────────────────────────────────────────────
function getMultiplier(attackType, defenderType, defenderDualType = null) {
  function singleMult(aType, dType) {
    if (dType  === 'phantom') return 0.75;
    if (aType  === 'phantom') return 1.25;
    if (aType  === 'iron')    return 1.0;
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
  // Dual-type: use the more favourable (lower) multiplier for the defender
  return Math.min(primaryMult, singleMult(attackType, defenderDualType));
}

function calcDamage(attacker, attack, defender) {
  const base = Math.max(5, attack.damage + Math.floor((attacker.atk - defender.def) / 4));
  return Math.round(base * getMultiplier(attack.type, defender.type, defender.dualType));
}

// ── Returns the index of the higher-damage attack, or -1 if both are equal ───
// -1 means no cooldown applies (equal damage = symmetric attacks).
function getStrongIdx(attacks) {
  if (!attacks || attacks.length < 2) return -1;
  if (attacks[0].damage === attacks[1].damage) return -1;
  return attacks[0].damage > attacks[1].damage ? 0 : 1;
}

// ── HP bar ───────────────────────────────────────────────────────────────────
function HpBar({ current, max }) {
  const pct   = Math.max(0, Math.min(100, (current / max) * 100));
  const color = pct > 55 ? '#1E5631' : pct > 25 ? '#7D5A00' : '#8B2500';
  return (
    <div className="hp-bar-wrap">
      <div className="hp-bar-track">
        <div className="hp-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="hp-bar-text">{Math.max(0, current)} / {max} HP</span>
    </div>
  );
}

// ── Team status pips ─────────────────────────────────────────────────────────
function TeamPips({ team, label, side }) {
  return (
    <div className={`team-pips team-pips--${side}`}>
      <span className="team-pips-label">{label}</span>
      <div className="pips-row">
        {team.map((c, i) => (
          <span
            key={i}
            className={`pip ${c.currentHp <= 0 ? 'pip--fainted' : 'pip--alive'}`}
            style={{ '--pip-color': `var(--ink-${c.type})` }}
            title={`${c.name}: ${Math.max(0, c.currentHp)}/${c.hp} HP`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Slider for stat redistribution after level-up ────────────────────────────
function RedistSlider({ label, value, min, max, onChange, remaining }) {
  const effectiveMax = Math.min(max, value + Math.max(0, remaining));
  const fillPct = ((value - min) / (max - min) * 100).toFixed(1) + '%';
  return (
    <div className="redist-slider-row">
      <span className="redist-label">{label}</span>
      <input
        type="range"
        min={min}
        max={effectiveMax}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="redist-input"
        style={{ '--fill-pct': fillPct }}
      />
      <span className="redist-value">{value}</span>
    </div>
  );
}

// ── Arena ────────────────────────────────────────────────────────────────────
export default function Arena() {
  const navigate = useNavigate();
  const logRef   = useRef(null);

  useEffect(() => { AudioManager.playMusic('/sounds/battle.mp3'); }, []);

  const [collection] = useState(
    () => JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]')
  );

  // ── Selection state ──
  const [selectedIds, setSelectedIds] = useState([]);
  const [difficulty,  setDifficulty]  = useState('medium');

  // ── Battle state ──
  const [phase,        setPhase]        = useState('selecting');
  const [playerTeam,   setPlayerTeam]   = useState([]);
  const [enemyTeam,    setEnemyTeam]    = useState([]);
  const [playerIdx,    setPlayerIdx]    = useState(0);
  const [enemyIdx,     setEnemyIdx]     = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [log,          setLog]          = useState([]);
  const [busy,         setBusy]         = useState(false);
  const [winner,       setWinner]       = useState(null);
  const [coinsEarned,  setCoinsEarned]  = useState(0);

  // ── Cooldown state ── [attackIdx0, attackIdx1] = turns remaining
  const [playerCooldowns, setPlayerCooldowns] = useState([0, 0]);
  const [cooldownFlash,   setCooldownFlash]   = useState(-1); // idx that just unlocked

  // ── Level-up redistribution state ──
  const [levelUps,       setLevelUps]       = useState([]);
  const [showRedist,     setShowRedist]      = useState(false);
  const [redistCreature, setRedistCreature]  = useState(null);
  const [redistStats,    setRedistStats]     = useState(null);

  // ── Field-training state (fires after every win) ──
  const [fieldParticipants,  setFieldParticipants]  = useState([]);
  const [showFieldTraining,  setShowFieldTraining]  = useState(false);
  const [fieldCreature,      setFieldCreature]      = useState(null);
  const [fieldStats,         setFieldStats]         = useState(null);

  // Mutable ref for async-safe reads inside setTimeout callbacks.
  const b = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function addLog(text, type = 'info') {
    setLog(prev => [...prev, { text, type }]);
  }

  // ── Toggle creature selection (max 5) ─────────────────────────────────────
  function toggleSelect(id) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5)  return prev;
      return [...prev, id];
    });
  }

  // ── Build teams and kick off the battle ───────────────────────────────────
  function startBattle() {
    const diff = DIFFICULTY[difficulty];

    const pt = selectedIds.map(id => {
      const c = collection.find(x => x.id === id);
      return { ...c, currentHp: c.hp };
    });

    const et = [...CHALLENGERS]
      .sort(() => Math.random() - 0.5)
      .slice(0, diff.teamSize)
      .map(c => {
        const scaled = scaledChallenger(c, diff.statMult);
        return { ...scaled, currentHp: scaled.hp };
      });

    b.current = { pt, et, pi: 0, ei: 0, cooldowns: [0, 0], coinMult: diff.coinMult };

    setPlayerTeam(pt);
    setEnemyTeam(et);
    setPlayerIdx(0);
    setEnemyIdx(0);
    setWinner(null);
    setLog([]);
    setPlayerCooldowns([0, 0]);
    setCooldownFlash(-1);
    setPhase('battling');

    const playerFirst = pt[0].spd >= et[0].spd;
    setIsPlayerTurn(playerFirst);

    addLog(`⚔️ ${diff.icon} ${diff.label} — ${diff.teamSize} challengers step forward!`, 'system');
    addLog(`Your team: ${pt.map(c => c.name).join(', ')}`, 'system');
    addLog(
      playerFirst
        ? `${pt[0].name} moves first! (SPD ${pt[0].spd})`
        : `${et[0].name} strikes first! (SPD ${et[0].spd})`,
      'system'
    );

    if (!playerFirst) {
      setBusy(true);
      setTimeout(() => runEnemyTurn(), 1300);
    }
  }

  // ── Log one hit; return defender's remaining HP ───────────────────────────
  function strikeLog(attacker, attack, defender, isPlayer) {
    const dmg  = calcDamage(attacker, attack, defender);
    // Use the attack's own type for the hit SFX (important for dual-type creatures).
    AudioManager.playHit(attack.type, dmg, defender.hp);
    const mult = getMultiplier(attack.type, defender.type, defender.dualType);
    const cap  = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
    let tag = '';
    if (mult > 1) {
      tag = attack.type?.toLowerCase() === 'phantom'
        ? ' ✨ Phantom strikes all types harder!'
        : ` ✨ ${cap(attack.type)} is strong against ${cap(defender.type)}!`;
    } else if (mult < 1) {
      tag = defender.type?.toLowerCase() === 'phantom'
        ? ' 😬 Phantom absorbs some of that damage.'
        : ` 😬 ${cap(defender.type)} resists that attack.`;
    }
    addLog(
      `${attacker.name} used ${attack.name}! Dealt ${dmg} damage.${tag}`,
      isPlayer ? 'player' : 'enemy'
    );
    return Math.max(0, defender.currentHp - dmg);
  }

  // ── Player picks an attack ────────────────────────────────────────────────
  function handlePlayerAttack(attack, attackIdx) {
    if (busy || !isPlayerTurn || phase !== 'battling') return;
    if (b.current.cooldowns[attackIdx] > 0) return; // blocked by cooldown
    setBusy(true);

    const { pt, et, pi, ei } = b.current;

    // Set 2-turn cooldown on the strong attack when used
    const strongIdx = getStrongIdx(pt[pi].attacks);
    if (attackIdx === strongIdx) {
      b.current.cooldowns = b.current.cooldowns.map((cd, i) => i === attackIdx ? 2 : cd);
      setPlayerCooldowns([...b.current.cooldowns]);
    }

    const newHp = strikeLog(pt[pi], attack, et[ei], true);
    const newEt = et.map((c, i) => i === ei ? { ...c, currentHp: newHp } : c);
    b.current = { ...b.current, et: newEt };
    setEnemyTeam([...newEt]);

    if (newHp <= 0) {
      addLog(`${et[ei].name} fainted!`, 'system');
      const nextEi = newEt.findIndex((c, i) => i > ei && c.currentHp > 0);
      if (nextEi === -1) {
        finishBattle('player');
        return;
      }
      setTimeout(() => {
        addLog(`${newEt[nextEi].name} enters the arena!`, 'system');
        b.current = { ...b.current, ei: nextEi };
        setEnemyIdx(nextEi);
        setIsPlayerTurn(true);
        setBusy(false);
      }, 800);
      return;
    }

    setTimeout(() => runEnemyTurn(), 1000);
  }

  // ── Enemy AI: pick a random attack ───────────────────────────────────────
  function runEnemyTurn() {
    const { pt, et, pi, ei } = b.current;
    const attack = et[ei].attacks[Math.floor(Math.random() * et[ei].attacks.length)];
    const newHp  = strikeLog(et[ei], attack, pt[pi], false);

    const newPt = pt.map((c, i) => i === pi ? { ...c, currentHp: newHp } : c);
    b.current = { ...b.current, pt: newPt };
    setPlayerTeam([...newPt]);

    if (newHp <= 0) {
      addLog(`${pt[pi].name} fainted!`, 'system');
      const hasAlive = newPt.some((c, i) => i !== pi && c.currentHp > 0);
      if (!hasAlive) {
        setTimeout(() => finishBattle('enemy'), 600);
        return;
      }
      setTimeout(() => {
        addLog('Choose your next creature!', 'system');
        setPhase('switching');
        setBusy(false);
      }, 700);
      return;
    }

    // Decrement player cooldowns and check for flash
    const prevCooldowns = [...b.current.cooldowns];
    b.current.cooldowns = b.current.cooldowns.map(cd => Math.max(0, cd - 1));
    setPlayerCooldowns([...b.current.cooldowns]);

    const flashIdx = prevCooldowns.findIndex((cd, i) => cd === 1 && b.current.cooldowns[i] === 0);
    if (flashIdx >= 0) {
      setCooldownFlash(flashIdx);
      setTimeout(() => setCooldownFlash(-1), 900);
    }

    setIsPlayerTurn(true);
    setBusy(false);
  }

  // ── Player sends in a new creature after theirs fainted ───────────────────
  function handleSwitch(newPi) {
    b.current = { ...b.current, pi: newPi, cooldowns: [0, 0] };
    setPlayerIdx(newPi);
    setPlayerCooldowns([0, 0]);
    setCooldownFlash(-1);
    addLog(`${b.current.pt[newPi].name} enters the arena!`, 'system');
    setIsPlayerTurn(true);
    setPhase('battling');
    setBusy(false);
  }

  // ── End the battle ────────────────────────────────────────────────────────
  function finishBattle(side) {
    if (side === 'player') {
      const base  = 10 + Math.floor(b.current.et.reduce((s, c) => s + c.hp, 0) / 5);
      const coins = Math.round(base * (b.current.coinMult ?? 1));
      const current = Number(localStorage.getItem(profileKey('coins')) || '0');
      localStorage.setItem(profileKey('coins'), String(current + coins));

      // Record the victory and check for story milestones
      incrementBattlesWon();
      const pending = checkMilestones();
      if (pending.length > 0) {
        sessionStorage.setItem('pending-milestones', JSON.stringify(pending));
      }

      setCoinsEarned(coins);
      addLog(`All challengers defeated! Victory! 🪙 +${coins} coins`, 'system');

      // Award XP to every creature that entered the battle
      const allCreatures = JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]');
      const participatedIds = new Set(b.current.pt.map(c => c.id));
      const lvlUps = [];

      const updatedCreatures = allCreatures.map(c => {
        if (!participatedIds.has(c.id)) return c;
        const level     = c.level || 1;
        const newXp     = (c.xp || 0) + 1;
        const threshold = level * 3;
        if (newXp >= threshold && level < 10) {
          const newLevel = level + 1;
          lvlUps.push({ ...c, level: newLevel, xp: newXp - threshold });
          return { ...c, level: newLevel, xp: newXp - threshold };
        }
        return { ...c, xp: newXp };
      });

      localStorage.setItem(profileKey('creatures'), JSON.stringify(updatedCreatures));

      if (lvlUps.length > 0) {
        setLevelUps(lvlUps);
        // Legendary creatures' stats are fixed — skip their redist slot
        const firstEligible = lvlUps.find(c => !c.isLegendary);
        if (firstEligible) {
          setRedistCreature(firstEligible);
          setRedistStats({ hp: firstEligible.hp, atk: firstEligible.atk, def: firstEligible.def, spd: firstEligible.spd });
        }
      }

      // Field training always fires after a win — one creature, +5 points (legendaries excluded)
      setFieldParticipants(updatedCreatures.filter(c => participatedIds.has(c.id) && !c.isLegendary));

      AudioManager.playSfx('/sounds/crowd-cheer.mp3');
    } else {
      addLog('Your whole team fainted… better luck next time!', 'system');
      AudioManager.playSfx('/sounds/crowd-sad.mp3');
    }
    setWinner(side);
    setPhase('finished');
    setBusy(false);
  }

  // ── Confirm field-training bonus (+5 points) for one creature ────────────
  function handleFieldConfirm() {
    const allCreatures = JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]');
    const updated = allCreatures.map(c =>
      c.id === fieldCreature.id
        ? { ...c, hp: fieldStats.hp, currentHp: fieldStats.hp,
            atk: fieldStats.atk, def: fieldStats.def, spd: fieldStats.spd }
        : c
    );
    localStorage.setItem(profileKey('creatures'), JSON.stringify(updated));
    setShowFieldTraining(false);
    setFieldCreature(null);
    setFieldStats(null);
  }

  // ── Confirm stat redistribution for one leveled-up creature ──────────────
  function handleRedistConfirm() {
    const allCreatures = JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]');
    const updated = allCreatures.map(c =>
      c.id === redistCreature.id
        ? { ...c,
            hp: redistStats.hp, currentHp: redistStats.hp,
            atk: redistStats.atk, def: redistStats.def, spd: redistStats.spd }
        : c
    );
    localStorage.setItem(profileKey('creatures'), JSON.stringify(updated));

    const currentIdx = levelUps.findIndex(c => c.id === redistCreature.id);
    const next = levelUps.slice(currentIdx + 1).find(c => !c.isLegendary);
    if (next) {
      setRedistCreature(next);
      setRedistStats({ hp: next.hp, atk: next.atk, def: next.def, spd: next.spd });
    } else {
      setShowRedist(false);
      setLevelUps([]);
      setRedistCreature(null);
      setRedistStats(null);
    }
  }

  // ── Reset to team selection ───────────────────────────────────────────────
  function resetBattle() {
    setPhase('selecting');
    setSelectedIds([]);
    setDifficulty('medium');
    setPlayerTeam([]);
    setEnemyTeam([]);
    setLog([]);
    setWinner(null);
    setBusy(false);
    setPlayerCooldowns([0, 0]);
    setCooldownFlash(-1);
    setLevelUps([]);
    setShowRedist(false);
    setRedistCreature(null);
    setRedistStats(null);
    setFieldParticipants([]);
    setShowFieldTraining(false);
    setFieldCreature(null);
    setFieldStats(null);
    b.current = null;
  }

  const playerActive = playerTeam[playerIdx];
  const enemyActive  = enemyTeam[enemyIdx];
  const maxSelect    = Math.min(5, collection.length);

  // Strong-attack index for the current active creature (-1 = no cooldown)
  const strongIdx = playerActive ? getStrongIdx(playerActive.attacks) : -1;

  // Level-up redistribution derived values
  const redistEligible  = levelUps.filter(c => !c.isLegendary);
  const redistPool      = redistCreature ? 200 + ((redistCreature.level || 1) - 1) * 20 : 200;
  const redistUsed      = redistStats
    ? (redistStats.hp - 50) + (redistStats.atk - 10) + (redistStats.def - 10) + (redistStats.spd - 10)
    : 0;
  const redistRemaining = redistPool - redistUsed;

  // Field-training derived values — +5 bonus on top of whatever the creature already has
  const fieldPool = fieldCreature
    ? (fieldCreature.hp - 50) + (fieldCreature.atk - 10) + (fieldCreature.def - 10) + (fieldCreature.spd - 10) + 5
    : 0;
  const fieldUsed = fieldStats
    ? (fieldStats.hp - 50) + (fieldStats.atk - 10) + (fieldStats.def - 10) + (fieldStats.spd - 10)
    : 0;
  const fieldRemaining = fieldPool - fieldUsed;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="arena-page">

      {/* Header */}
      <header className="arena-header">
        <button className="arena-back-btn" onClick={() => navigate('/manor')}>← Manor</button>
        <div className="arena-title-group">
          <span className="arena-title-icon">⚔️</span>
          <h1 className="arena-title">The Arena</h1>
          {phase !== 'selecting' && enemyTeam.length > 0 && (
            <>
              <span className="arena-vs-tag">vs. {enemyTeam.length}</span>
              <span className={`arena-diff-badge arena-diff-badge--${difficulty}`}>
                {DIFFICULTY[difficulty].icon} {DIFFICULTY[difficulty].label}
              </span>
            </>
          )}
        </div>
        <div className="arena-header-filler" aria-hidden />
      </header>

      {/* ══ SELECTION PHASE ══════════════════════════════════════════════════ */}
      {phase === 'selecting' && (
        <main className="arena-select">
          {collection.length === 0 ? (
            <div className="arena-empty">
              <span className="arena-empty-icon">🌱</span>
              <p className="arena-empty-title">No creatures yet!</p>
              <p className="arena-empty-body">
                Head to The Lab to create your first creature before entering the arena.
              </p>
              <button className="arena-empty-btn" onClick={() => navigate('/lab')}>
                ⚗️ Go to The Lab
              </button>
            </div>
          ) : (
            <>
              <p className="select-prompt">
                <span className="select-ornament">✦</span>
                Pick up to {maxSelect} fighters for your team
                <span className="select-ornament">✦</span>
              </p>
              <p className="select-count">{selectedIds.length} / {maxSelect} selected</p>

              {/* ── Difficulty picker ── */}
              <div className="difficulty-section">
                <p className="difficulty-heading">Difficulty</p>
                <div className="difficulty-row">
                  {Object.values(DIFFICULTY).map(d => (
                    <button
                      key={d.id}
                      className={[
                        'difficulty-btn',
                        `difficulty-btn--${d.id}`,
                        difficulty === d.id ? 'difficulty-btn--selected' : '',
                      ].join(' ').trim()}
                      onClick={() => setDifficulty(d.id)}
                    >
                      <span className="difficulty-icon">{d.icon}</span>
                      <span className="difficulty-label">{d.label}</span>
                    </button>
                  ))}
                </div>
                <p className="difficulty-desc">{DIFFICULTY[difficulty].desc}</p>
              </div>

              {selectedIds.length > 0 && (
                <div className="arena-start-sticky">
                  <button className="arena-start-btn arena-start-btn--top" onClick={startBattle}>
                    ⚔️ Enter the Arena! ({selectedIds.length} fighter{selectedIds.length !== 1 ? 's' : ''})
                  </button>
                </div>
              )}

              <div className="select-grid">
                {collection.map(creature => {
                  const selIdx   = selectedIds.indexOf(creature.id);
                  const isChosen = selIdx !== -1;
                  return (
                    <div
                      key={creature.id}
                      className={`select-slot${isChosen ? ' select-slot--chosen' : ''}`}
                      onClick={() => toggleSelect(creature.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && toggleSelect(creature.id)}
                    >
                      <CreatureCard creature={creature} />
                      {isChosen && (
                        <div className="select-badge">#{selIdx + 1}</div>
                      )}
                      <div className="select-hover-overlay">
                        {isChosen ? '✓ Selected' : '⚔️ Select'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      )}

      {/* ══ BATTLE / SWITCHING / FINISHED ════════════════════════════════════ */}
      {(phase === 'battling' || phase === 'switching' || phase === 'finished')
        && playerActive && enemyActive && (
        <main className="arena-battle">

          {/* Team status pips */}
          <div className="teams-row">
            <TeamPips team={playerTeam} label="Your Team"   side="player" />
            <TeamPips team={enemyTeam}  label="Challengers" side="enemy"  />
          </div>

          {/* Active creatures face to face */}
          <div className="battlefield">
            <div className="battle-side">
              <p className="side-label side-label--you">You</p>
              <CreatureCard creature={playerActive} />
              <HpBar current={playerActive.currentHp} max={playerActive.hp} />
            </div>

            <div className="battle-vs-divider">⚔️</div>

            <div className="battle-side">
              <p className="side-label side-label--enemy">Challenger</p>
              <CreatureCard creature={enemyActive} />
              <HpBar current={enemyActive.currentHp} max={enemyActive.hp} />
            </div>
          </div>

          {/* Battle log */}
          <div className="battle-log" ref={logRef}>
            {log.map((entry, i) => (
              <p key={i} className={`log-line log-${entry.type}`}>{entry.text}</p>
            ))}
          </div>

          {/* Attack buttons */}
          {phase === 'battling' && (
            <div className="battle-actions">
              {isPlayerTurn && !busy ? (
                <div className="attack-btn-row">
                  {playerActive.attacks.map((attack, i) => {
                    const onCooldown = playerCooldowns[i] > 0;
                    const isFlashing = cooldownFlash === i;
                    const isStrong   = i === strongIdx;
                    return (
                      <button
                        key={i}
                        className={[
                          'attack-btn',
                          onCooldown  ? 'attack-btn--cooldown' : '',
                          isFlashing  ? 'attack-btn--ready'    : '',
                        ].join(' ').trim()}
                        onClick={() => handlePlayerAttack(attack, i)}
                        disabled={onCooldown}
                      >
                        <span className="attack-btn-name">{attack.name}</span>
                        <span className="attack-btn-dmg">{attack.damage} dmg</span>
                        {isStrong && !onCooldown && !isFlashing && (
                          <span className="attack-strong-star" title="Strong attack — 2-turn cooldown">★</span>
                        )}
                        {onCooldown && (
                          <span className="attack-cooldown-badge">⏱ {playerCooldowns[i]}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="enemy-thinking">
                  ⏳ {enemyActive.name} is thinking…
                </p>
              )}
            </div>
          )}

          {/* Switch panel — shown when player's creature faints */}
          {phase === 'switching' && (
            <div className="switch-panel">
              <p className="switch-prompt">✦ Choose your next fighter! ✦</p>
              <div className="switch-grid">
                {playerTeam.map((c, i) => {
                  if (c.currentHp <= 0) return null;
                  return (
                    <div
                      key={c.id}
                      className="select-slot"
                      onClick={() => handleSwitch(i)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleSwitch(i)}
                    >
                      <CreatureCard creature={c} />
                      <div className="select-hover-overlay">⚔️ Send in!</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Winner overlay */}
          {phase === 'finished' && (
            <div className="winner-overlay">
              <div className="winner-panel">
                {winner === 'player' ? (
                  <>
                    <span className="winner-icon">🏆</span>
                    <h2 className="winner-title">Victory!</h2>
                    <p className="winner-body">
                      Your team defeated all the challengers!
                    </p>
                    <p className="winner-coins">+{coinsEarned} 🪙 coins earned</p>

                    {/* Level-up notification */}
                    {levelUps.length > 0 && (
                      <div className="winner-levelups">
                        <p className="winner-levelup-headline">⭐ Level Up!</p>
                        {levelUps.map(c => (
                          <p key={c.id} className="winner-levelup-row">
                            <span className="winner-levelup-name">{c.name}</span>
                            <span className="winner-levelup-badge">Lv {c.level}</span>
                          </p>
                        ))}
                        {redistCreature && (
                          <button
                            className="winner-redist-btn"
                            onClick={() => setShowRedist(true)}
                          >
                            ✦ Redistribute Stats
                          </button>
                        )}
                      </div>
                    )}

                    {/* Field training — only offered when at least one non-legendary participated */}
                    {fieldParticipants.length > 0 && (
                      <div className="winner-levelups">
                        <p className="winner-levelup-headline">🏋️ Field Training</p>
                        <p className="winner-field-hint">Your creatures gained experience in battle.</p>
                        <button
                          className="winner-redist-btn"
                          onClick={() => setShowFieldTraining(true)}
                        >
                          ✦ Allocate 5 Bonus Points
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="winner-icon">💫</span>
                    <h2 className="winner-title">Defeated…</h2>
                    <p className="winner-body">
                      Your whole team fainted.<br />
                      Train harder and try again!
                    </p>
                  </>
                )}
                <div className="winner-btn-row">
                  <button className="winner-btn winner-btn--primary" onClick={resetBattle}>
                    ⚔️ Battle Again
                  </button>
                  <button className="winner-btn winner-btn--secondary" onClick={() => navigate('/manor')}>
                    ← Manor
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      )}

      {/* ══ LEVEL-UP STAT REDISTRIBUTION OVERLAY ═════════════════════════════ */}
      {/* ══ FIELD TRAINING OVERLAY ═══════════════════════════════════════════ */}
      {showFieldTraining && (
        <div className="redist-overlay">
          <div className="redist-panel">
            <span className="redist-star">🏋️</span>
            <h2 className="redist-title">Field Training!</h2>
            <p className="redist-hint">Field training complete! Allocate 5 bonus points to a creature that fought.</p>

            {!fieldCreature ? (
              <div className="field-pick-list">
                {fieldParticipants.map(c => (
                  <button
                    key={c.id}
                    className="field-pick-btn"
                    onClick={() => {
                      setFieldCreature(c);
                      setFieldStats({ hp: c.hp, atk: c.atk, def: c.def, spd: c.spd });
                    }}
                  >
                    {c.name}
                    <span className="field-pick-level">Lv {c.level || 1}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p className="redist-creature-name">{fieldCreature.name}</p>

                <div className="redist-pool-row">
                  <span className="redist-pool-label">Points remaining</span>
                  <span
                    className="redist-pool-value"
                    style={{ color: fieldRemaining === 0 ? '#8B2500' : '#C49A3C' }}
                  >
                    {fieldRemaining} / {fieldPool}
                  </span>
                </div>

                <div className="redist-sliders">
                  <RedistSlider
                    label="HP"  value={fieldStats.hp}  min={50}  max={200}
                    onChange={v => setFieldStats(s => ({ ...s, hp: v }))}
                    remaining={fieldRemaining}
                  />
                  <RedistSlider
                    label="ATK" value={fieldStats.atk} min={10}  max={100}
                    onChange={v => setFieldStats(s => ({ ...s, atk: v }))}
                    remaining={fieldRemaining}
                  />
                  <RedistSlider
                    label="DEF" value={fieldStats.def} min={10}  max={100}
                    onChange={v => setFieldStats(s => ({ ...s, def: v }))}
                    remaining={fieldRemaining}
                  />
                  <RedistSlider
                    label="SPD" value={fieldStats.spd} min={10}  max={100}
                    onChange={v => setFieldStats(s => ({ ...s, spd: v }))}
                    remaining={fieldRemaining}
                  />
                </div>

                <button className="redist-confirm-btn" onClick={handleFieldConfirm}>
                  ✦ Confirm Training
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showRedist && redistCreature && redistStats && (
        <div className="redist-overlay">
          <div className="redist-panel">
            <span className="redist-star">⭐</span>
            <h2 className="redist-title">Level Up!</h2>
            <p className="redist-creature-name">{redistCreature.name}</p>
            <p className="redist-reached">reached Level {redistCreature.level}</p>
            <p className="redist-hint">Redistribute all your stat points with your new budget.</p>

            <div className="redist-pool-row">
              <span className="redist-pool-label">Points remaining</span>
              <span
                className="redist-pool-value"
                style={{ color: redistRemaining === 0 ? '#8B2500' : '#C49A3C' }}
              >
                {redistRemaining} / {redistPool}
              </span>
            </div>

            <div className="redist-sliders">
              <RedistSlider
                label="HP"  value={redistStats.hp}  min={50}  max={200}
                onChange={v => setRedistStats(s => ({ ...s, hp: v }))}
                remaining={redistRemaining}
              />
              <RedistSlider
                label="ATK" value={redistStats.atk} min={10}  max={100}
                onChange={v => setRedistStats(s => ({ ...s, atk: v }))}
                remaining={redistRemaining}
              />
              <RedistSlider
                label="DEF" value={redistStats.def} min={10}  max={100}
                onChange={v => setRedistStats(s => ({ ...s, def: v }))}
                remaining={redistRemaining}
              />
              <RedistSlider
                label="SPD" value={redistStats.spd} min={10}  max={100}
                onChange={v => setRedistStats(s => ({ ...s, spd: v }))}
                remaining={redistRemaining}
              />
            </div>

            <button className="redist-confirm-btn" onClick={handleRedistConfirm}>
              ✦ Confirm Stats
            </button>

            {redistEligible.length > 1 && (
              <p className="redist-progress">
                Creature {redistEligible.findIndex(c => c.id === redistCreature.id) + 1} of {redistEligible.length}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
