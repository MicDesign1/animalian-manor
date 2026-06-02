import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatureCard from '../components/CreatureCard';
import StoryLetter from '../components/StoryLetter';
import { profileKey } from '../data/profiles';
import { setStoryFlag, setJournalPages } from '../data/gameProgress';
import { LEGENDARY_ART_PATHS } from '../data/reservedArt';
import AudioManager from '../audio/AudioManager';
import { getMultiplier, calcDamage, isStrongAttack, rollInitiative, initiativeText, chooseBestAttack } from '../data/combat';
import InitiativeBanner from '../components/InitiativeBanner';
import './BasementBattle.css';
import './Arena.css';

// ── Boss creature ─────────────────────────────────────────────────────────────
const RZ_BASE = {
  id:        'rz-boss',
  name:      'RZ',
  type:      'iron',
  dualType:  'tide',
  hp: 320, atk: 115, def: 105, spd: 55,
  level: 9,
  attacks: [
    { name: 'Tidal Crush',  damage: 70, type: 'tide' },
    { name: 'Iron Torrent', damage: 65, type: 'iron' },
  ],
  isLegendary: true,
  image: LEGENDARY_ART_PATHS.rz,
};

// ── HP bar ────────────────────────────────────────────────────────────────────
function HpBar({ current, max }) {
  const pct   = Math.max(0, Math.min(100, (current / max) * 100));
  const color = pct > 55 ? '#1E5631' : pct > 25 ? '#7D5A00' : '#8B2500';
  return (
    <div className="bsmt-hp-wrap">
      <div className="bsmt-hp-track">
        <div className="bsmt-hp-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="bsmt-hp-text">{Math.max(0, current)} / {max} HP</span>
    </div>
  );
}

// ── Team status pips ──────────────────────────────────────────────────────────
function TeamPips({ team, label, side }) {
  return (
    <div className={`bsmt-pips bsmt-pips--${side}`}>
      <span className="bsmt-pips-label">{label}</span>
      <div className="bsmt-pips-row">
        {team.map((c, i) => (
          <span
            key={i}
            className={`bsmt-pip ${c.currentHp <= 0 ? 'bsmt-pip--fainted' : 'bsmt-pip--alive'}`}
            style={{ '--pip-color': `var(--ink-${c.type})` }}
            title={`${c.name}: ${Math.max(0, c.currentHp)}/${c.hp} HP`}
          />
        ))}
      </div>
    </div>
  );
}

// ── BasementBattle ────────────────────────────────────────────────────────────
export default function BasementBattle() {
  const navigate = useNavigate();
  const logRef   = useRef(null);
  const b        = useRef(null);

  useEffect(() => { AudioManager.playMusic('/sounds/boss-battle.mp3'); }, []);

  const [collection] = useState(
    () => JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]')
  );

  // Find the two required legendary creatures from the collection
  const genesis = collection.find(c => c.name === 'Genesis' && c.isLegendary);
  const rekron  = collection.find(c => c.name === 'Rekron'  && c.isLegendary);
  const hasLegendaries = !!(genesis && rekron);

  // Phases: descent → locked → battling → switching → victory | defeat
  const [phase,        setPhase]       = useState('descent');
  const [descentStep,  setDescentStep] = useState(0);
  const [victoryStep,  setVictoryStep] = useState(0);

  // Initiative banner state
  const [initiativeRoll, setInitiativeRoll] = useState(null);

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

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function addLog(text, type = 'info') {
    setLog(prev => [...prev, { text, type }]);
  }

  // ── Start the battle ──────────────────────────────────────────────────────
  function startBattle() {
    if (!hasLegendaries) return;

    const pt = [
      { ...genesis, currentHp: genesis.hp },
      { ...rekron,  currentHp: rekron.hp  },
    ];
    const rz = { ...RZ_BASE, currentHp: RZ_BASE.hp };
    const et = [rz];

    b.current = { pt, et, pi: 0, ei: 0, cooldowns: [0, 0] };

    setPlayerTeam(pt);
    setEnemyTeam(et);
    setPlayerIdx(0);
    setEnemyIdx(0);
    setLog([]);
    setPlayerCooldowns([0, 0]);
    setCooldownFlash(-1);
    setPhase('battling');

    const init = rollInitiative(pt[0].spd, rz.spd);
    setInitiativeRoll({ id: Date.now(), playerName: pt[0].name, enemyName: rz.name, ...init });
    const playerFirst = init.playerFirst;
    setIsPlayerTurn(playerFirst);

    addLog('🎭 "RZ — show them what we found beneath the world."', 'enemy');
    addLog(`${pt[0].name} and ${pt[1].name} step forward.`, 'system');
    addLog(initiativeText(pt[0].name, rz.name, init), 'system');
    addLog(`${playerFirst ? pt[0].name : rz.name} wins initiative and moves first!`, 'system');

    if (!playerFirst) {
      setBusy(true);
      setTimeout(() => runEnemyTurn(), 1300);
    }
  }

  // ── Log one hit; return defender's remaining HP ───────────────────────────
  function strikeLog(attacker, attack, defender, isPlayer) {
    const atkType = attack.type ?? attacker.type;
    const dmg  = calcDamage(attacker, attack, defender);
    AudioManager.playHit(atkType, dmg, defender.hp);
    const mult = getMultiplier(atkType, defender.type, defender.dualType);
    const cap  = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
    let tag = '';
    if (mult > 1) {
      tag = defender.type?.toLowerCase() === 'phantom'
        ? ' ✨ Phantom is fragile — it takes extra damage!'
        : atkType?.toLowerCase() === 'phantom'
        ? ' ✨ Phantom strikes all types harder!'
        : ` ✨ ${cap(atkType)} is strong against ${cap(defender.type)}!`;
    } else if (mult < 1) {
      tag = ` 😬 ${cap(defender.type)} resists that attack.`;
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
    if (b.current.cooldowns[attackIdx] > 0) return;
    setBusy(true);

    const { pt, et, pi, ei } = b.current;

    if (isStrongAttack(pt[pi].attacks, attackIdx)) {
      b.current.cooldowns = b.current.cooldowns.map((cd, i) => i === attackIdx ? 2 : cd);
      setPlayerCooldowns([...b.current.cooldowns]);
    }

    const newHp = strikeLog(pt[pi], attack, et[ei], true);
    const newEt = et.map((c, i) => i === ei ? { ...c, currentHp: newHp } : c);
    b.current = { ...b.current, et: newEt };
    setEnemyTeam([...newEt]);

    if (newHp <= 0) {
      addLog(`${et[ei].name} has fallen!`, 'system');
      // RZ is the only enemy — check if any remain
      const nextEi = newEt.findIndex((c, i) => i > ei && c.currentHp > 0);
      if (nextEi === -1) {
        finishBattle('player');
        return;
      }
      setTimeout(() => {
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
    const attack = chooseBestAttack(et[ei], pt[pi]) || et[ei].attacks[0];
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
        addLog('Choose your next legendary!', 'system');
        setPhase('switching');
        setBusy(false);
      }, 700);
      return;
    }

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

  // ── Player switches after their creature fainted ──────────────────────────
  function handleSwitch(newPi) {
    b.current = { ...b.current, pi: newPi, cooldowns: [0, 0] };
    setPlayerIdx(newPi);
    setPlayerCooldowns([0, 0]);
    setCooldownFlash(-1);
    setPhase('battling');

    const { pt, et, ei } = b.current;
    addLog(`${pt[newPi].name} enters the battle!`, 'system');

    const init = rollInitiative(pt[newPi].spd, et[ei].spd);
    setInitiativeRoll({ id: Date.now(), playerName: pt[newPi].name, enemyName: et[ei].name, ...init });
    addLog(initiativeText(pt[newPi].name, et[ei].name, init), 'system');
    addLog(`${init.playerFirst ? pt[newPi].name : et[ei].name} wins initiative and moves first!`, 'system');

    if (init.playerFirst) {
      setIsPlayerTurn(true);
      setBusy(false);
    } else {
      setIsPlayerTurn(false);
      setBusy(true);
      setTimeout(() => runEnemyTurn(), 1000);
    }
  }

  // ── End the battle ────────────────────────────────────────────────────────
  function finishBattle(side) {
    if (side === 'player') {
      addLog('⚔️ RZ has been defeated. The basement falls silent.', 'system');
      AudioManager.playSfx('/sounds/crowd-cheer.mp3');
      setTimeout(() => {
        setBusy(false);
        setPhase('victory');
        setVictoryStep(0);
      }, 1200);
    } else {
      addLog("RZ's power was overwhelming… Genesis and Rekron survived, but barely.", 'system');
      AudioManager.playSfx('/sounds/crowd-sad.mp3');
      setTimeout(() => {
        setBusy(false);
        setPhase('defeat');
      }, 1500);
    }
  }

  // ── Victory completion — sets flags, awards coins, returns to manor ───────
  function completeVictory() {
    setStoryFlag('masked-man-defeated', true);
    setStoryFlag('basement-discovered', true);
    setJournalPages(6);
    const coins = Number(localStorage.getItem(profileKey('coins')) || '0');
    localStorage.setItem(profileKey('coins'), String(coins + 100));
    navigate('/manor');
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const playerActive = playerTeam[playerIdx];
  const enemyActive  = enemyTeam[enemyIdx];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="basement-page">
      {/* Atmospheric candlelight effect */}
      <div className="basement-candlelight" aria-hidden />

      {/* Header */}
      <header className="basement-header">
        <button className="basement-back-btn" onClick={() => navigate('/manor')}>← Manor</button>
        <div className="basement-title-group">
          <span className="basement-title-icon">🎭</span>
          <h1 className="basement-title">The Basement — vs The Masked Man</h1>
        </div>
        <div className="basement-header-filler" aria-hidden />
      </header>

      {/* ── DESCENT: First StoryLetter ── */}
      <StoryLetter
        visible={phase === 'descent' && descentStep === 0}
        type="narrative"
        icon="🔓"
        title="Beneath the Manor"
        paragraphs={[
          "The trapdoor opens with a groan. Stone steps descend into darkness.",
          "The air is cold. Damp. The walls are lined with shelves — specimen jars, sealed crates, instruments you don't recognise.",
          "This was not a cellar. This was a laboratory. A secret one.",
          "At the far end, a figure stands in the dim light. A mask covers their face. They've been waiting.",
        ]}
        buttonText="Approach"
        onClose={() => setDescentStep(1)}
      />

      {/* ── DESCENT: Second StoryLetter ── */}
      <StoryLetter
        visible={phase === 'descent' && descentStep === 1}
        type="narrative"
        icon="🎭"
        title="The Masked Man"
        paragraphs={[
          "\"You're too late. I've already found what I came for.\"",
          "He holds up a torn journal page — one of Uncle Argon's.",
          "\"Your uncle thought he could keep the source to himself. Hide it away in journals and riddles. But I was his colleague long before you were his heir.\"",
          "\"He made a mistake trusting you with this place. Let me show you what REAL power looks like.\"",
          "A creature materialises beside him. It crackles with unstable energy — water and metal fused together in a way that looks wrong. Forced. Powerful, but broken.",
          "\"Meet RZ.\"",
        ]}
        buttonText="Prepare for Battle"
        onClose={() => setPhase('locked')}
      />

      {/* ── TEAM LOCK ── */}
      {phase === 'locked' && (
        <main className="basement-locked">
          {hasLegendaries ? (
            <div className="basement-lock-ready">
              <p className="basement-lock-heading">Your Legendary Pair</p>
              <p className="basement-lock-body">
                This battle requires Genesis and Rekron — the legendary creatures entrusted to you by Mira.
              </p>
              <div className="arena-start-sticky">
                <button className="basement-lock-btn arena-start-btn--top" onClick={startBattle}>
                  Begin Battle →
                </button>
              </div>
              <div className="basement-lock-cards">
                <CreatureCard creature={genesis} />
                <CreatureCard creature={rekron} />
              </div>
            </div>
          ) : (
            <div className="basement-lock-missing">
              <span className="basement-lock-missing-icon">🔒</span>
              <p className="basement-lock-heading">Legendary Creatures Required</p>
              <p className="basement-lock-body">
                You need both Genesis and Rekron for this battle. Speak to Mira in the Parlour if you haven't received them yet.
              </p>
              <button className="basement-lock-btn basement-lock-btn--back" onClick={() => navigate('/manor')}>
                Return to Manor
              </button>
            </div>
          )}
        </main>
      )}

      {/* ── BATTLE + SWITCHING ── */}
      {(phase === 'battling' || phase === 'switching') && playerActive && enemyActive && (
        <main className="basement-battle">
          <InitiativeBanner roll={initiativeRoll} />

          {/* Team status pips */}
          <div className="bsmt-teams-row">
            <TeamPips team={playerTeam} label="Your Legendaries" side="player" />
            <TeamPips team={enemyTeam}  label="The Masked Man"   side="enemy"  />
          </div>

          {/* Active creatures */}
          <div className="bsmt-battlefield">
            <div className="bsmt-battle-side">
              <p className="bsmt-side-label bsmt-side-label--you">You</p>
              <CreatureCard creature={playerActive} />
              <HpBar current={playerActive.currentHp} max={playerActive.hp} />
            </div>

            <div className="bsmt-battle-vs">⚔️</div>

            <div className="bsmt-battle-side">
              <p className="bsmt-side-label bsmt-side-label--enemy">Masked Man</p>
              <CreatureCard creature={enemyActive} />
              <HpBar current={enemyActive.currentHp} max={enemyActive.hp} />
            </div>
          </div>

          {/* Battle log */}
          <div className="bsmt-log" ref={logRef}>
            {log.map((entry, i) => (
              <p key={i} className={`bsmt-log-line bsmt-log-${entry.type}`}>{entry.text}</p>
            ))}
          </div>

          {/* Attack buttons */}
          {phase === 'battling' && (
            <div className="bsmt-actions">
              {isPlayerTurn && !busy ? (
                <div className="bsmt-attack-row">
                  {playerActive.attacks.map((attack, i) => {
                    const onCooldown = playerCooldowns[i] > 0;
                    const isFlashing = cooldownFlash === i;
                    const isStrong   = isStrongAttack(playerActive.attacks, i);
                    return (
                      <button
                        key={i}
                        className={[
                          'bsmt-attack-btn',
                          onCooldown ? 'bsmt-attack-btn--cooldown' : '',
                          isFlashing ? 'bsmt-attack-btn--ready'    : '',
                        ].join(' ').trim()}
                        onClick={() => handlePlayerAttack(attack, i)}
                        disabled={onCooldown}
                      >
                        <span className="bsmt-attack-name">{attack.name}</span>
                        <span className="bsmt-attack-dmg">{attack.damage} dmg</span>
                        {isStrong && !onCooldown && !isFlashing && (
                          <span className="bsmt-attack-star" title="Strong attack — 2-turn cooldown">★</span>
                        )}
                        {onCooldown && (
                          <span className="bsmt-attack-cd">⏱ {playerCooldowns[i]}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="bsmt-thinking">
                  ⏳ {enemyActive.name} is thinking…
                </p>
              )}
            </div>
          )}

          {/* Switch panel */}
          {phase === 'switching' && (
            <div className="bsmt-switch-panel">
              <p className="bsmt-switch-prompt">✦ Send in your other legendary! ✦</p>
              <div className="bsmt-switch-grid">
                {playerTeam.map((c, i) => {
                  if (c.currentHp <= 0) return null;
                  return (
                    <div
                      key={c.id}
                      className="bsmt-switch-slot"
                      onClick={() => handleSwitch(i)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleSwitch(i)}
                    >
                      <CreatureCard creature={c} />
                      <div className="bsmt-switch-hover">⚔️ Send in!</div>
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
        <div className="basement-defeat-overlay">
          <div className="basement-defeat-panel">
            <span className="basement-defeat-icon">💫</span>
            <h2 className="basement-defeat-title">Overwhelmed…</h2>
            <p className="basement-defeat-body">
              RZ's power was overwhelming. But Genesis and Rekron survived — they're tougher than they look.
            </p>
            <p className="basement-defeat-hint">
              Regroup and try again.
            </p>
            <button className="basement-defeat-btn basement-defeat-btn--retry"
              onClick={() => {
                setPhase('locked');
                setLog([]);
                setPlayerCooldowns([0, 0]);
                setCooldownFlash(-1);
              }}>
              ⚔️ Try Again
            </button>
            <button className="basement-defeat-btn" onClick={() => navigate('/manor')}>
              ← Return to Manor
            </button>
          </div>
        </div>
      )}

      {/* ── VICTORY: "The Mask Falls" narrative ── */}
      <StoryLetter
        visible={phase === 'victory' && victoryStep === 0}
        type="narrative"
        icon="🏆"
        title="The Mask Falls"
        paragraphs={[
          "RZ collapses. The unstable energy dissipates like steam.",
          "The masked man staggers backward. For a moment he just stares at you.",
          "\"Argon was right about you.\"",
          "He pulls something from his coat and throws it at your feet — a journal page, crumpled but intact. Then he turns and disappears into the dark passage behind the shelves.",
          "You are alone in the basement. But you have what he tried to take.",
        ]}
        buttonText="Pick Up the Journal Page"
        onClose={() => setVictoryStep(1)}
      />

      {/* ── VICTORY: Journal page reveal ── */}
      <StoryLetter
        visible={phase === 'victory' && victoryStep === 1}
        type="journal"
        icon="✦"
        title="Argon's Journal — Day 1,847"
        subtitle="The final coordinates"
        paragraphs={[
          "Day 1,847 — Supplemental",
          "If you are reading this, then you have proven everything I hoped.",
          "The creatures we know — Ember, Tide, Thorn, Storm, Phantom, Iron — they are not creations. They are echoes of the elements. Fragments of something older and more vast than I can describe.",
          "I have found the source. The place where the first Animalian came into being. It is not on any map. The coordinates are encoded in the binding of this journal — you will need the cipher from my study to decode them.",
          "I cannot return from this place. Not yet. Something here prevents it — an artefact, ancient beyond measure, that binds those who enter.",
          "But I am alive. I am waiting.",
          "Bring the cipher. Find the coordinates. Come and find me.",
          "— Your Uncle Argon",
        ]}
        buttonText="Close Journal"
        onClose={completeVictory}
      />

    </div>
  );
}
