import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileKey } from '../data/profiles';
import './MatchGame.css';

// Pair-count options shown to the player
const PAIR_OPTIONS = [4, 6, 8];

// ── Type data for the symbol-style cards ──────────────────────────────────────
const TYPE_DATA = {
  ember:   { icon: '🔥', label: 'Ember',   color: '#8B2500', bg: '#3D1000' },
  tide:    { icon: '🌊', label: 'Tide',    color: '#1B4F72', bg: '#0A1828' },
  thorn:   { icon: '🌿', label: 'Thorn',   color: '#1E5631', bg: '#0A1A0A' },
  storm:   { icon: '⚡', label: 'Storm',   color: '#7D5A00', bg: '#1E1600' },
  phantom: { icon: '🌙', label: 'Phantom', color: '#4A1942', bg: '#180A1A' },
  iron:    { icon: '⚙️', label: 'Iron',    color: '#555560', bg: '#111118' },
};

// ── Build pairs from the player's collection + type symbols ───────────────────
// Creature pairs come first, then type symbols fill the rest up to numPairs.
function buildPairs(collection, numPairs) {
  const withImages = collection.filter(c => c.image);
  const shuffled   = [...withImages].sort(() => Math.random() - 0.5);
  const creatures  = shuffled.slice(0, numPairs);

  const pairs = creatures.map(c => ({
    matchKey:           String(c.id),
    kind:               'creature',
    name:               c.name,
    image:              c.image,
    type:               c.type || 'iron',
    imagePosition:      c.imagePosition,
    imageColor:         c.imageColor    ?? null,
    imageColorStrength: c.imageColorStrength ?? 60,
  }));

  const typeKeys = Object.keys(TYPE_DATA)
    .sort(() => Math.random() - 0.5)
    .slice(0, numPairs - pairs.length);

  for (const type of typeKeys) {
    pairs.push({ matchKey: `type_${type}`, kind: 'type', type });
  }

  return [...pairs, ...pairs]
    .sort(() => Math.random() - 0.5)
    .map((p, i) => ({ ...p, id: i, flipped: false, matched: false }));
}

// ── Card component ────────────────────────────────────────────────────────────
function MatchCard({ card, onClick }) {
  const t = TYPE_DATA[card.type] || TYPE_DATA.iron;

  return (
    <div
      className={[
        'match-card',
        card.flipped  ? 'match-card--flipped' : '',
        card.matched  ? 'match-card--matched'  : '',
      ].join(' ').trim()}
      onClick={() => onClick(card)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(card)}
      aria-label={card.flipped || card.matched
        ? (card.kind === 'creature' ? card.name : t.label)
        : 'Hidden card'}
    >
      <div className="match-card-inner">

        {/* Face-down back */}
        <div className="match-card-back">
          <div className="match-card-back-ornament">✦</div>
        </div>

        {/* Face-up front */}
        <div className="match-card-face" style={{ background: t.bg, borderColor: t.color }}>
          {card.kind === 'creature' ? (
            <>
              <div
                className="match-creature-img-wrap"
                style={{ borderColor: t.color, isolation: card.imageColor ? 'isolate' : undefined }}
              >
                <img
                  src={card.image}
                  alt={card.name}
                  className="match-creature-img"
                  style={{
                    objectPosition:
                      `${card.imagePosition?.x ?? 50}% ${card.imagePosition?.y ?? 50}%`,
                  }}
                  draggable={false}
                />
                {card.imageColor && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: card.imageColor,
                    mixBlendMode:    'color',
                    opacity:         card.imageColorStrength / 100,
                    pointerEvents:   'none',
                  }} />
                )}
              </div>
              <span className="match-creature-name" style={{ color: t.color }}>
                {card.name}
              </span>
            </>
          ) : (
            <>
              <span className="match-card-icon">{t.icon}</span>
              <span className="match-card-type-label" style={{ color: t.color }}>{t.label}</span>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Match Game page ───────────────────────────────────────────────────────────
export default function MatchGame() {
  const navigate = useNavigate();

  const [collection] = useState(
    () => JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]')
  );

  // Max pairs = creatures with images + all 6 type symbols, capped at 8
  const maxPairs = Math.min(
    collection.filter(c => c.image).length + Object.keys(TYPE_DATA).length,
    8
  );

  const [pairCount,    setPairCount]    = useState(Math.min(6, maxPairs));
  const [cards,        setCards]        = useState([]);
  const [selected,     setSelected]     = useState([]);
  const [moves,        setMoves]        = useState(0);
  const [misses,       setMisses]       = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [busy,         setBusy]         = useState(false);
  const [phase,        setPhase]        = useState('setup');
  const [coinsEarned,  setCoinsEarned]  = useState(0);

  // Prize = pairCount×5 base, −2 per miss only (matches don't cost anything)
  const coinsPreview = Math.max(pairCount, pairCount * 5 - misses * 2);

  const creaturePairCount = cards.length > 0
    ? [...new Set(cards.filter(c => c.kind === 'creature').map(c => c.matchKey))].length
    : 0;

  // Win detection
  useEffect(() => {
    if (phase === 'playing' && matchedPairs === pairCount) {
      const coins   = Math.max(pairCount, pairCount * 5 - misses * 2);
      const current = Number(localStorage.getItem(profileKey('coins')) || '0');
      localStorage.setItem(profileKey('coins'), String(current + coins));
      setCoinsEarned(coins);
      setTimeout(() => setPhase('won'), 500);
    }
  }, [matchedPairs, phase, pairCount, misses]);

  function startGame() {
    const latest = JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]');
    setCards(buildPairs(latest, pairCount));
    setSelected([]);
    setMoves(0);
    setMisses(0);
    setMatchedPairs(0);
    setBusy(false);
    setCoinsEarned(0);
    setPhase('playing');
  }

  function handleCardClick(card) {
    if (busy || card.flipped || card.matched || phase !== 'playing') return;

    setCards(prev => prev.map(c => c.id === card.id ? { ...c, flipped: true } : c));

    if (selected.length === 0) {
      setSelected([card]);
      return;
    }

    const firstCard = selected[0];
    setSelected([]);
    setMoves(m => m + 1);
    setBusy(true);

    const isMatch = firstCard.matchKey === card.matchKey;

    setTimeout(() => {
      if (isMatch) {
        setCards(prev => prev.map(c =>
          c.id === firstCard.id || c.id === card.id
            ? { ...c, matched: true, flipped: true }
            : c
        ));
        setMatchedPairs(p => p + 1);
      } else {
        setMisses(m => m + 1); // only misses reduce the prize
        setCards(prev => prev.map(c =>
          c.id === firstCard.id || c.id === card.id
            ? { ...c, flipped: false }
            : c
        ));
      }
      setBusy(false);
    }, 900);
  }

  // Go back to setup screen (re-reads collection so new creatures appear)
  function goToSetup() {
    setCards([]);
    setSelected([]);
    setMoves(0);
    setMisses(0);
    setMatchedPairs(0);
    setBusy(false);
    setCoinsEarned(0);
    setPhase('setup');
  }

  // ── Setup screen ───────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="game-page match-page">
        <header className="game-header">
          <button className="game-back-btn" onClick={() => navigate('/vault')}>← Vault</button>
          <div className="game-title-group">
            <span className="game-title-icon">🃏</span>
            <h1 className="game-title">Memory Match</h1>
          </div>
          <div className="game-header-filler" aria-hidden />
        </header>

        <main className="match-setup-main">
          <p className="match-setup-tagline">How many pairs?</p>
          <p className="match-setup-desc">More pairs = harder game, bigger prize!</p>

          <div className="match-size-options">
            {PAIR_OPTIONS.filter(n => n <= maxPairs).map(n => (
              <button
                key={n}
                className={`match-size-btn${pairCount === n ? ' match-size-btn--selected' : ''}`}
                onClick={() => setPairCount(n)}
              >
                <span className="match-size-num">{n}</span>
                <span className="match-size-label">pairs</span>
                <span className="match-size-cards">{n * 2} cards</span>
                <span className="match-size-prize">Up to {n * 5} 🪙</span>
              </button>
            ))}
          </div>

          <button className="match-start-btn" onClick={startGame}>
            Start Game
          </button>
        </main>
      </div>
    );
  }

  // ── Playing / Won screen ───────────────────────────────────────────────────
  return (
    <div className="game-page match-page">
      <header className="game-header">
        <button className="game-back-btn" onClick={goToSetup}>← Setup</button>
        <div className="game-title-group">
          <span className="game-title-icon">🃏</span>
          <h1 className="game-title">Memory Match</h1>
        </div>
        <div className="game-header-filler" aria-hidden />
      </header>

      <main className="match-main">
        {/* Stats bar */}
        <div className="match-stats">
          <span className="match-stat">
            Pairs: <strong>{matchedPairs} / {pairCount}</strong>
          </span>
          <span className="match-stat">
            Misses: <strong>{misses}</strong>
          </span>
          <span className="match-stat match-stat--coins">
            Prize: <strong>{coinsPreview} 🪙</strong>
          </span>
        </div>

        {/* Card grid — always 4 columns, rows grow automatically */}
        <div className="match-grid">
          {cards.map(card => (
            <MatchCard key={card.id} card={card} onClick={handleCardClick} />
          ))}
        </div>

        <p className="match-hint">
          {creaturePairCount > 0
            ? `${creaturePairCount} pair${creaturePairCount !== 1 ? 's' : ''} from your collection — find all ${pairCount}!`
            : `Find all ${pairCount} matching pairs!`}
        </p>
      </main>

      {/* Win overlay */}
      {phase === 'won' && (
        <div className="game-result-overlay">
          <div className="game-result-panel">
            <span className="game-result-icon">🎉</span>
            <h2 className="game-result-title">All Pairs Found!</h2>
            <p className="game-result-body">
              {misses === 0
                ? 'Perfect game — no misses!'
                : `${moves} move${moves !== 1 ? 's' : ''}, ${misses} miss${misses !== 1 ? 'es' : ''}.`}
            </p>
            <p className="game-result-coins">+{coinsEarned} 🪙 coins earned</p>
            <div className="game-result-btns">
              <button className="game-result-btn game-result-btn--primary" onClick={startGame}>
                Play Again
              </button>
              <button className="game-result-btn game-result-btn--secondary" onClick={goToSetup}>
                Change Size
              </button>
              <button className="game-result-btn game-result-btn--secondary" onClick={() => navigate('/vault')}>
                ← Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
