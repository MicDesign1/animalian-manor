import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileKey } from '../data/profiles';
import './DiceGame.css';

const TYPES = ['ember', 'tide', 'thorn', 'storm', 'phantom', 'iron'];

const TYPE_DATA = {
  ember:   { icon: '🔥', label: 'Ember',   color: '#8B2500', bg: 'linear-gradient(135deg,#5C1208,#2A0800)' },
  tide:    { icon: '🌊', label: 'Tide',    color: '#1B4F72', bg: 'linear-gradient(135deg,#1A3A5C,#080E18)' },
  thorn:   { icon: '🌿', label: 'Thorn',   color: '#1E5631', bg: 'linear-gradient(135deg,#1A3A22,#080E08)' },
  storm:   { icon: '⚡', label: 'Storm',   color: '#7D5A00', bg: 'linear-gradient(135deg,#4A3800,#181200)' },
  phantom: { icon: '🌙', label: 'Phantom', color: '#4A1942', bg: 'linear-gradient(135deg,#2D0F40,#0C0418)' },
  iron:    { icon: '⚙️', label: 'Iron',    color: '#555560', bg: 'linear-gradient(135deg,#252530,#0C0C10)' },
};

function randomType() {
  return TYPES[Math.floor(Math.random() * TYPES.length)];
}

// Count the best-matching group in 3 dice
function countMatches(dice) {
  const counts = {};
  dice.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  return Math.max(...Object.values(counts));
}

export default function DiceGame() {
  const navigate  = useNavigate();
  const intervalRef = useRef(null);

  const [dice,        setDice]        = useState(['iron', 'iron', 'iron']); // start state
  const [rolling,     setRolling]     = useState(false);
  const [result,      setResult]      = useState(null); // null | {matches, coins}
  const [sessionCoins,setSessionCoins]= useState(0);
  const [rollCount,   setRollCount]   = useState(0);

  function handleRoll() {
    if (rolling) return;
    setRolling(true);
    setResult(null);
    setRollCount(n => n + 1);

    let frames = 0;
    const totalFrames = 14;
    intervalRef.current = setInterval(() => {
      setDice([randomType(), randomType(), randomType()]);
      frames++;
      if (frames >= totalFrames) {
        clearInterval(intervalRef.current);
        const final = [randomType(), randomType(), randomType()];
        setDice(final);

        const matches = countMatches(final);
        let coins = 0;
        if (matches === 3) coins = 25;
        else if (matches === 2) coins = 10;

        if (coins > 0) {
          const current = Number(localStorage.getItem(profileKey('coins')) || '0');
          localStorage.setItem(profileKey('coins'), String(current + coins));
          setSessionCoins(prev => prev + coins);
        }

        setResult({ matches, coins });
        setRolling(false);
      }
    }, 70);
  }

  const resultMsg = result
    ? result.matches === 3
      ? '🎉 Three of a kind!'
      : result.matches === 2
        ? '✨ A matching pair!'
        : '🎲 No match — try again!'
    : null;

  return (
    <div className="game-page dice-page">
      <header className="game-header">
        <button className="game-back-btn" onClick={() => navigate('/vault')}>← Vault</button>
        <div className="game-title-group">
          <span className="game-title-icon">🎲</span>
          <h1 className="game-title">Argon's Lucky Dice</h1>
        </div>
        <div className="game-header-filler" aria-hidden />
      </header>

      <main className="dice-main">
        <p className="dice-rules">
          Roll 3 dice. Match 2 for 10 🪙 — match all 3 for 25 🪙!
        </p>

        {/* The three dice */}
        <div className="dice-tray">
          {dice.map((type, i) => (
            <div
              key={i}
              className={`die${rolling ? ' die--rolling' : ''}${result && result.matches > 1 && dice.filter(d => d === type).length > 1 ? ' die--matched' : ''}`}
              style={{ background: TYPE_DATA[type].bg, borderColor: TYPE_DATA[type].color }}
            >
              <span className="die-icon">{TYPE_DATA[type].icon}</span>
              <span className="die-label">{TYPE_DATA[type].label}</span>
            </div>
          ))}
        </div>

        {/* Result line */}
        {result && !rolling && (
          <div className={`dice-result dice-result--${result.matches}`}>
            <p className="dice-result-msg">{resultMsg}</p>
            {result.coins > 0 && (
              <p className="dice-result-coins">+{result.coins} 🪙</p>
            )}
          </div>
        )}

        {/* Roll button */}
        <button
          className={`dice-roll-btn${rolling ? ' dice-roll-btn--rolling' : ''}`}
          onClick={handleRoll}
          disabled={rolling}
        >
          {rolling ? 'Rolling…' : rollCount === 0 ? '🎲 Roll the Dice!' : '🎲 Roll Again'}
        </button>

        {/* Session total */}
        {sessionCoins > 0 && (
          <p className="dice-session-total">
            Session total: {sessionCoins} 🪙 coins won
          </p>
        )}

        {/* Odds reminder */}
        <div className="dice-odds">
          <span>Pair (2 of 6): ~42% chance</span>
          <span>Three of a kind: ~3% chance</span>
        </div>
      </main>
    </div>
  );
}
