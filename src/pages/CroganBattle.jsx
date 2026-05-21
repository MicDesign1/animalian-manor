import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatureCard from '../components/CreatureCard';
import StoryLetter from '../components/StoryLetter';
import { playCreated } from '../utils/sounds';
import { profileKey } from '../data/profiles';
import { setStoryFlag, setJournalPages } from '../data/gameProgress';
import { getRandomImage } from '../data/creatureImages';
import { LEGENDARY_ART_PATHS, isReservedArt } from '../data/reservedArt';
import AudioManager from '../audio/AudioManager';
import './CroganBattle.css';
import './Arena.css';

// ── Crogan's fixed team ──────────────────────────────────────────────────────
const CROGAN_TEAM = [
  { id: 'c1', name: 'Slag',     type: 'iron',  hp: 170, atk: 70, def: 65, spd: 25,
    attacks: [{ name: 'Iron Bash',   damage: 40, type: 'iron'  },
              { name: 'Slag Hammer', damage: 55, type: 'iron'  }] },
  { id: 'c2', name: 'Char',     type: 'ember', hp: 140, atk: 80, def: 40, spd: 50,
    attacks: [{ name: 'Fire Snarl',  damage: 35, type: 'ember' },
              { name: 'Blaze Crush', damage: 50, type: 'ember' }] },
  { id: 'c3', name: 'Rustfang', type: 'iron',  hp: 160, atk: 65, def: 70, spd: 30,
    attacks: [{ name: 'Metal Bite',  damage: 38, type: 'iron'  },
              { name: 'Forge Slam',  damage: 52, type: 'iron'  }] },
];

// ── Type chart + damage ──────────────────────────────────────────────────────
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
    <div className="crogan-hp-wrap">
      <div className="crogan-hp-track">
        <div className="crogan-hp-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="crogan-hp-text">{Math.max(0, current)} / {max} HP</span>
    </div>
  );
}

// ── Team status pips ─────────────────────────────────────────────────────────
function TeamPips({ team, label, side }) {
  return (
    <div className={`crogan-pips crogan-pips--${side}`}>
      <span className="crogan-pips-label">{label}</span>
      <div className="crogan-pips-row">
        {team.map((c, i) => (
          <span
            key={i}
            className={`crogan-pip ${c.currentHp <= 0 ? 'crogan-pip--fainted' : 'crogan-pip--alive'}`}
            style={{ '--pip-color': `var(--ink-${c.type})` }}
            title={`${c.name}: ${Math.max(0, c.currentHp)}/${c.hp} HP`}
          />
        ))}
      </div>
    </div>
  );
}


// ── CroganBattle ─────────────────────────────────────────────────────────────
export default function CroganBattle() {
  const navigate = useNavigate();
  const logRef   = useRef(null);

  useEffect(() => { AudioManager.playMusic('/sounds/boss-battle.mp3'); }, []);

  const [collection] = useState(
    () => JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]')
  );

  // Phases: intro → selecting → battling → switching → victory | defeat
  const [phase,        setPhase]        = useState('intro');
  const [victoryStep,  setVictoryStep]  = useState(0);
  const [selectedIds,  setSelectedIds]  = useState([]);

  // Battle state
  const [playerTeam,      setPlayerTeam]      = useState([]);
  const [enemyTeam,       setEnemyTeam]       = useState([]);
  const [playerIdx,       setPlayerIdx]       = useState(0);
  const [enemyIdx,        setEnemyIdx]        = useState(0);
  const [isPlayerTurn,    setIsPlayerTurn]    = useState(true);
  const [log,             setLog]             = useState([]);
  const [busy,            setBusy]            = useState(false);
  const [playerCooldowns, setPlayerCooldowns] = useState([0, 0]);
  const [cooldownFlash,   setCooldownFlash]   = useState(-1);

  // Mutable ref for async-safe reads inside setTimeout callbacks
  const b = useRef(null);

  // Stable legendary creature data — IDs fixed at mount
  const genesisRef = useRef({
    id: 'genesis-' + Date.now(),
    name: 'Genesis', type: 'storm', dualType: 'ember',
    hp: 170, currentHp: 170, atk: 80, def: 65, spd: 70,
    level: 5, xp: 0, isLegendary: true,
    attacks: [
      { name: 'Stormflare',  damage: 45, type: 'storm' },
      { name: 'Ember Surge', damage: 42, type: 'ember' },
    ],
    image: LEGENDARY_ART_PATHS.genesis, imagePosition: { x: 50, y: 50 },
  });

  const rekronRef = useRef({
    id: 'rekron-' + Date.now(),
    name: 'Rekron', type: 'ember', dualType: 'iron',
    hp: 165, currentHp: 165, atk: 85, def: 75, spd: 50,
    level: 5, xp: 0, isLegendary: true,
    attacks: [
      { name: 'Forge Fire', damage: 48, type: 'ember' },
      { name: 'Iron Blaze', damage: 40, type: 'iron'  },
    ],
    image: LEGENDARY_ART_PATHS.rekron, imagePosition: { x: 50, y: 50 },
  });

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function addLog(text, type = 'info') {
    setLog(prev => [...prev, { text, type }]);
  }

  // ── Team selection ────────────────────────────────────────────────────────
  function toggleSelect(id) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5)  return prev;
      return [...prev, id];
    });
  }

  // ── Start the battle ──────────────────────────────────────────────────────
  function startBattle() {
    if (selectedIds.length === 0) return;

    const pt = selectedIds.map(id => {
      const c = collection.find(x => x.id === id);
      return { ...c, currentHp: c.hp };
    });

    const et = CROGAN_TEAM.map(c => {
      const img = getRandomImage();
      return { ...c, currentHp: c.hp, image: isReservedArt(img) ? getRandomImage() : img };
    });

    b.current = { pt, et, pi: 0, ei: 0, cooldowns: [0, 0] };

    setPlayerTeam(pt);
    setEnemyTeam(et);
    setPlayerIdx(0);
    setEnemyIdx(0);
    setLog([]);
    setPlayerCooldowns([0, 0]);
    setCooldownFlash(-1);
    setPhase('battling');

    const playerFirst = pt[0].spd >= et[0].spd;
    setIsPlayerTurn(playerFirst);

    addLog('⚔️ Crogan smirks. "You think you can beat me? Pathetic."', 'system');
    addLog(`Your team: ${pt.map(c => c.name).join(', ')}`, 'system');
    addLog(`Crogan sends in: ${et[0].name}!`, 'enemy');
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
    AudioManager.playHit(attack.type, dmg, defender.hp);
    const mult = getMultiplier(attack.type, defender.type, defender.dualType);
    const tag  = mult > 1 ? ' ✨ Super effective!' : mult < 1 ? ' 😬 Not very effective…' : '';
    addLog(
      `${attacker.name} used ${attack.name}! Dealt ${dmg} damage.${tag}`,
      isPlayer ? 'player' : 'enemy'
    );
    return Math.max(0, defender.currentHp - dmg);
  }

  // ── Player picks an attack ────────────────────────────────────────────────
  function handlePlayerAttack(attack, attackIdx) {
    if (busy || !isPlayerTurn || phase !== 'battling') return;
    if (b.current.cooldowns[attackIdx] > 0) return;
    setBusy(true);

    const { pt, et, pi, ei } = b.current;

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
        addLog(`Crogan sends in: ${newEt[nextEi].name}!`, 'enemy');
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

    // Decrement cooldowns and check for flash
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

  // ── Player sends in a new creature after theirs fainted ──────────────────
  function handleSwitch(newPi) {
    b.current = { ...b.current, pi: newPi, cooldowns: [0, 0] };
    setPlayerIdx(newPi);
    setPlayerCooldowns([0, 0]);
    setCooldownFlash(-1);
    addLog(`${b.current.pt[newPi].name} enters the battle!`, 'system');
    setIsPlayerTurn(true);
    setPhase('battling');
    setBusy(false);
  }

  // ── End the battle ────────────────────────────────────────────────────────
  function finishBattle(side) {
    if (side === 'player') {
      addLog('⚔️ Crogan is defeated! The village square erupts in cheers!', 'system');
      AudioManager.playSfx('/sounds/crowd-cheer.mp3');
      setTimeout(() => {
        setBusy(false);
        setPhase('victory');
        setVictoryStep(0);
      }, 1200);
    } else {
      addLog('Your whole team fainted… Crogan stands victorious.', 'system');
      AudioManager.playSfx('/sounds/crowd-sad.mp3');
      setTimeout(() => {
        setBusy(false);
        setPhase('defeat');
      }, 1500);
    }
  }

  // ── Victory sequence ──────────────────────────────────────────────────────
  function advanceVictory() {
    const next = victoryStep + 1;
    if (next > 3) {
      completeVictory();
    } else {
      if (next === 2) setTimeout(() => playCreated(), 200);
      setVictoryStep(next);
    }
  }

  function completeVictory() {
    const creatures = JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]');
    const genesis = genesisRef.current;
    const rekron  = rekronRef.current;
    if (!creatures.find(c => c.name === 'Genesis')) creatures.push(genesis);
    if (!creatures.find(c => c.name === 'Rekron'))  creatures.push(rekron);
    localStorage.setItem(profileKey('creatures'), JSON.stringify(creatures));

    const coins = Number(localStorage.getItem(profileKey('coins')) || '0');
    localStorage.setItem(profileKey('coins'), String(coins + 50));

    setStoryFlag('mira-bully-quest-complete', true);
    setStoryFlag('genesis-received', true);
    setStoryFlag('rekron-received', true);
    setJournalPages(3);

    navigate('/parlor');
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const playerActive = playerTeam[playerIdx];
  const enemyActive  = enemyTeam[enemyIdx];
  const maxSelect    = Math.min(5, collection.length);
  const strongIdx    = playerActive ? getStrongIdx(playerActive.attacks) : -1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="crogan-page">

      {/* Header */}
      <header className="crogan-header">
        <button className="crogan-back-btn" onClick={() => navigate('/parlor')}>← Parlour</button>
        <div className="crogan-title-group">
          <span className="crogan-title-icon">⚔️</span>
          <h1 className="crogan-title">Village Square — vs Crogan</h1>
        </div>
        <div className="crogan-header-filler" aria-hidden />
      </header>

      {/* ── INTRO STORY LETTER ── */}
      <StoryLetter
        visible={phase === 'intro'}
        type="narrative"
        icon="⚔️"
        title="The Village Square"
        subtitle="A matter of honour"
        paragraphs={[
          "Word has reached the manor: a man named Crogan has been terrorising the village market. Traders have fled, children are afraid, and nobody dares stand up to him.",
          "Crogan keeps Iron and Ember type creatures — heavy, brutal, and relentless. He uses them to bully and intimidate anyone who gets in his way.",
          "Mira, the Parlour's merchant, has asked for your help. She cannot face him alone, and the village is running out of hope.",
          "Your creatures are ready. The village square awaits.",
        ]}
        buttonText="Face Crogan →"
        onClose={() => setPhase('selecting')}
        secondaryButton={{ text: 'Turn Back', onClick: () => navigate('/parlor') }}
      />

      {/* ── TEAM SELECTION ── */}
      {phase === 'selecting' && (
        <main className="crogan-select">
          {collection.length === 0 ? (
            <div className="crogan-empty">
              <span className="crogan-empty-icon">🌱</span>
              <p className="crogan-empty-title">No creatures yet!</p>
              <p className="crogan-empty-body">
                Head to the Lab to create some creatures before facing Crogan.
              </p>
              <button className="crogan-empty-btn" onClick={() => navigate('/lab')}>
                ⚗️ Go to The Lab
              </button>
            </div>
          ) : (
            <>
              <p className="crogan-select-prompt">
                <span className="crogan-ornament">✦</span>
                Pick up to {maxSelect} fighters for your team
                <span className="crogan-ornament">✦</span>
              </p>
              <p className="crogan-select-count">{selectedIds.length} / {maxSelect} selected</p>

              {/* Show Crogan's lineup so the player can strategise */}
              <div className="crogan-enemy-preview">
                <p className="crogan-enemy-preview-label">Crogan's team:</p>
                <div className="crogan-enemy-chips">
                  {CROGAN_TEAM.map(c => (
                    <div key={c.id} className="crogan-enemy-chip">
                      <span className="crogan-enemy-chip-name">{c.name}</span>
                      <span className={`crogan-enemy-chip-type crogan-chip-type--${c.type}`}>{c.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="arena-start-sticky">
                <button
                  className="crogan-start-btn arena-start-btn--top"
                  onClick={startBattle}
                  disabled={selectedIds.length === 0}
                >
                  ⚔️ Fight! ({selectedIds.length} fighter{selectedIds.length !== 1 ? 's' : ''})
                </button>
              </div>

              <div className="crogan-select-grid">
                {collection.map(creature => {
                  const selIdx   = selectedIds.indexOf(creature.id);
                  const isChosen = selIdx !== -1;
                  return (
                    <div
                      key={creature.id}
                      className={`crogan-select-slot${isChosen ? ' crogan-select-slot--chosen' : ''}`}
                      onClick={() => toggleSelect(creature.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && toggleSelect(creature.id)}
                    >
                      <CreatureCard creature={creature} />
                      {isChosen && <div className="crogan-select-badge">#{selIdx + 1}</div>}
                      <div className="crogan-select-hover">
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

      {/* ── BATTLE + SWITCHING ── */}
      {(phase === 'battling' || phase === 'switching') && playerActive && enemyActive && (
        <main className="crogan-battle">

          {/* Team status pips */}
          <div className="crogan-teams-row">
            <TeamPips team={playerTeam} label="Your Team"    side="player" />
            <TeamPips team={enemyTeam}  label="Crogan's Team" side="enemy"  />
          </div>

          {/* Active creatures face to face */}
          <div className="crogan-battlefield">
            <div className="crogan-battle-side">
              <p className="crogan-side-label crogan-side-label--you">You</p>
              <CreatureCard creature={playerActive} />
              <HpBar current={playerActive.currentHp} max={playerActive.hp} />
            </div>

            <div className="crogan-battle-vs">⚔️</div>

            <div className="crogan-battle-side">
              <p className="crogan-side-label crogan-side-label--enemy">Crogan</p>
              <CreatureCard creature={enemyActive} />
              <HpBar current={enemyActive.currentHp} max={enemyActive.hp} />
            </div>
          </div>

          {/* Battle log */}
          <div className="crogan-log" ref={logRef}>
            {log.map((entry, i) => (
              <p key={i} className={`crogan-log-line crogan-log-${entry.type}`}>{entry.text}</p>
            ))}
          </div>

          {/* Attack buttons */}
          {phase === 'battling' && (
            <div className="crogan-actions">
              {isPlayerTurn && !busy ? (
                <div className="crogan-attack-row">
                  {playerActive.attacks.map((attack, i) => {
                    const onCooldown = playerCooldowns[i] > 0;
                    const isFlashing = cooldownFlash === i;
                    const isStrong   = i === strongIdx;
                    return (
                      <button
                        key={i}
                        className={[
                          'crogan-attack-btn',
                          onCooldown ? 'crogan-attack-btn--cooldown' : '',
                          isFlashing ? 'crogan-attack-btn--ready'    : '',
                        ].join(' ').trim()}
                        onClick={() => handlePlayerAttack(attack, i)}
                        disabled={onCooldown}
                      >
                        <span className="crogan-attack-name">{attack.name}</span>
                        <span className="crogan-attack-dmg">{attack.damage} dmg</span>
                        {isStrong && !onCooldown && !isFlashing && (
                          <span className="crogan-attack-star" title="Strong attack — 2-turn cooldown">★</span>
                        )}
                        {onCooldown && (
                          <span className="crogan-attack-cd">⏱ {playerCooldowns[i]}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="crogan-thinking">
                  ⏳ {enemyActive.name} is thinking…
                </p>
              )}
            </div>
          )}

          {/* Switch panel */}
          {phase === 'switching' && (
            <div className="crogan-switch-panel">
              <p className="crogan-switch-prompt">✦ Choose your next fighter! ✦</p>
              <div className="crogan-switch-grid">
                {playerTeam.map((c, i) => {
                  if (c.currentHp <= 0) return null;
                  return (
                    <div
                      key={c.id}
                      className="crogan-select-slot"
                      onClick={() => handleSwitch(i)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleSwitch(i)}
                    >
                      <CreatureCard creature={c} />
                      <div className="crogan-select-hover">⚔️ Send in!</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      )}

      {/* ── DEFEAT ── */}
      {phase === 'defeat' && (
        <div className="crogan-defeat-overlay">
          <div className="crogan-defeat-panel">
            <span className="crogan-defeat-icon">💫</span>
            <h2 className="crogan-defeat-title">Defeated…</h2>
            <p className="crogan-defeat-body">
              Your team couldn't hold out.<br />
              Crogan still holds the square.
            </p>
            <p className="crogan-defeat-hint">
              Rest your creatures and try again when you're ready.
            </p>
            <button className="crogan-defeat-btn crogan-defeat-btn--try-again"
              onClick={() => setPhase('selecting')}>
              ⚔️ Try Again
            </button>
            <button className="crogan-defeat-btn" onClick={() => navigate('/manor')}>
              ← Back to Manor
            </button>
          </div>
        </div>
      )}

      {/* ── VICTORY SEQUENCE ── */}

      {/* Step 0: Victory narrative */}
      <StoryLetter
        visible={phase === 'victory' && victoryStep === 0}
        type="narrative"
        icon="🏆"
        title="The Square Falls Silent"
        paragraphs={[
          "Crogan staggers back, his creatures too worn to fight on. For a long moment he simply stares at you — then turns and walks away without a word.",
          "A murmur rises from the doorways around the square. Then cheering. The traders begin to spill out onto the cobblestones, laughing and clapping each other on the back.",
        ]}
        buttonText="Continue →"
        onClose={advanceVictory}
      />

      {/* Step 1: Mira's Secret */}
      <StoryLetter
        visible={phase === 'victory' && victoryStep === 1}
        type="letter"
        icon="✦"
        title="Mira's Secret"
        paragraphs={[
          "Back at the Parlour, Mira is waiting. Her expression is different — serious, almost solemn.",
          "\"Thank you. Truly. But that's not why I asked you here alone.\"",
          "She reaches beneath the counter and lifts a heavy wooden box onto the table. It is old — the brass fittings are tarnished, the lock engraved with symbols you don't recognise.",
          "\"Your uncle gave me this box years ago. Told me to keep it locked and hidden until someone proved they deserved what's inside.\"",
          "She opens it. Inside, resting on dark velvet, are two cards. They are unlike anything in her shop — the parchment is heavier, the ink deeper, the borders etched with patterns that seem to shift in the candlelight.",
          "\"He made these himself. They are the only ones of their kind.\"",
        ]}
        buttonText="Receive the Cards"
        onClose={advanceVictory}
      />

      {/* Step 2: Genesis joins you */}
      <StoryLetter
        visible={phase === 'victory' && victoryStep === 2}
        type="narrative"
        icon="⚡🔥"
        title="Genesis"
        subtitle="Dual Type: Storm · Ember"
        paragraphs={[
          "A creature born of lightning and flame — the sky's fury given form.",
          "HP: 170 · ATK: 80 · DEF: 65 · SPD: 70",
          "Attacks: Stormflare (Storm, 45 dmg) · Ember Surge (Ember, 42 dmg)",
          "\"Genesis was the first dual-type creature your uncle ever created. Two elements in perfect balance — the strengths of both, the weaknesses of neither.\" — Mira",
        ]}
        buttonText="Continue →"
        onClose={advanceVictory}
      />

      {/* Step 3: Rekron joins you */}
      <StoryLetter
        visible={phase === 'victory' && victoryStep === 3}
        type="narrative"
        icon="🔥⚙️"
        title="Rekron"
        subtitle="Dual Type: Ember · Iron"
        paragraphs={[
          "A creature forged in fire and tempered in iron — relentless, unyielding, unstoppable.",
          "HP: 165 · ATK: 85 · DEF: 75 · SPD: 50",
          "Attacks: Forge Fire (Ember, 48 dmg) · Iron Blaze (Iron, 40 dmg)",
          "\"Rekron was the second. Your uncle said some forces were never meant to be separated. Fire and iron — destruction and endurance, forged as one.\" — Mira",
        ]}
        buttonText="Welcome them both →"
        onClose={advanceVictory}
      />

    </div>
  );
}
