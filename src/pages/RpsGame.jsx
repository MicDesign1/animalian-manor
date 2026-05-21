import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileKey } from '../data/profiles';
import './RpsGame.css';

const CHOICES = [
  { id: 'rock',     icon: '✊', label: 'Rock'     },
  { id: 'paper',    icon: '✋', label: 'Paper'    },
  { id: 'scissors', icon: '✌️', label: 'Scissors' },
];

// Names of the manor challengers (rotate through them)
const CHALLENGERS = [
  'Manor Hound', 'Garden Sprite', 'Storm Wren',
  'Ashviper',    'Shade Moth',    'Tideserpent',
];

function getWinner(player, manor) {
  if (player === manor) return 'draw';
  if (
    (player === 'rock'     && manor === 'scissors') ||
    (player === 'paper'    && manor === 'rock')     ||
    (player === 'scissors' && manor === 'paper')
  ) return 'win';
  return 'lose';
}

function randomChallenger() {
  return CHALLENGERS[Math.floor(Math.random() * CHALLENGERS.length)];
}

export default function RpsGame() {
  const navigate = useNavigate();

  const [challenger]    = useState(() => randomChallenger());
  const [playerScore,   setPlayerScore]   = useState(0);
  const [manorScore,    setManorScore]    = useState(0);
  const [playerChoice,  setPlayerChoice]  = useState(null);
  const [manorChoice,   setManorChoice]   = useState(null);
  const [roundResult,   setRoundResult]   = useState(null); // 'win'|'lose'|'draw'
  const [phase,         setPhase]         = useState('choosing'); // choosing|revealing|finished
  const [gameWinner,    setGameWinner]    = useState(null);  // 'player'|'manor'|'draw'
  const [coinsEarned,   setCoinsEarned]   = useState(0);

  function handleChoice(choiceId) {
    if (phase !== 'choosing') return;

    const manor  = CHOICES[Math.floor(Math.random() * CHOICES.length)].id;
    const result = getWinner(choiceId, manor);

    setPlayerChoice(choiceId);
    setManorChoice(manor);
    setPhase('revealing');

    setTimeout(() => {
      setRoundResult(result);
      const newPS = playerScore + (result === 'win'  ? 1 : 0);
      const newMS = manorScore  + (result === 'lose' ? 1 : 0);
      setPlayerScore(newPS);
      setManorScore(newMS);

      setTimeout(() => {
        if (newPS >= 2 || newMS >= 2) {
          const gw = newPS >= 2 ? 'player' : 'manor';
          setGameWinner(gw);
          if (gw === 'player') {
            const coins = 15;
            const current = Number(localStorage.getItem(profileKey('coins')) || '0');
            localStorage.setItem(profileKey('coins'), String(current + coins));
            setCoinsEarned(coins);
          }
          setPhase('finished');
        } else {
          setPhase('choosing');
          setPlayerChoice(null);
          setManorChoice(null);
          setRoundResult(null);
        }
      }, 1100);
    }, 700);
  }

  function resetGame() {
    setPlayerScore(0);
    setManorScore(0);
    setPlayerChoice(null);
    setManorChoice(null);
    setRoundResult(null);
    setGameWinner(null);
    setCoinsEarned(0);
    setPhase('choosing');
  }

  const playerLabel = CHOICES.find(c => c.id === playerChoice);
  const manorLabel  = CHOICES.find(c => c.id === manorChoice);

  return (
    <div className="game-page rps-page">
      <header className="game-header">
        <button className="game-back-btn" onClick={() => navigate('/vault')}>← Vault</button>
        <div className="game-title-group">
          <span className="game-title-icon">✊</span>
          <h1 className="game-title">Rock · Paper · Scissors</h1>
        </div>
        <div className="game-header-filler" aria-hidden />
      </header>

      <main className="rps-main">

        {/* Score & challenger */}
        <div className="rps-scoreboard">
          <div className="rps-score-side rps-score-side--you">
            <span className="rps-score-label">You</span>
            <span className="rps-score-num">{playerScore}</span>
          </div>
          <div className="rps-score-vs">
            <span className="rps-challenger-name">{challenger}</span>
            <span className="rps-best-of">Best of 3</span>
          </div>
          <div className="rps-score-side rps-score-side--manor">
            <span className="rps-score-label">Manor</span>
            <span className="rps-score-num">{manorScore}</span>
          </div>
        </div>

        {/* Round pips */}
        <div className="rps-pips">
          {[0, 1].map(i => (
            <div key={`p-${i}`} className={`rps-pip rps-pip--player${i < playerScore ? ' rps-pip--filled' : ''}`} />
          ))}
          <span className="rps-pips-divider">⬥</span>
          {[0, 1].map(i => (
            <div key={`m-${i}`} className={`rps-pip rps-pip--manor${i < manorScore ? ' rps-pip--filled' : ''}`} />
          ))}
        </div>

        {/* Battle display */}
        <div className="rps-arena">
          <div className={`rps-combatant rps-combatant--player${roundResult ? ` rps-combatant--${roundResult}` : ''}`}>
            <div className="rps-hand">
              {phase === 'choosing' ? '🤜' : (playerLabel?.icon ?? '❓')}
            </div>
            <span className="rps-hand-label">{phase === 'choosing' ? 'Choose!' : (playerLabel?.label ?? '')}</span>
          </div>

          <div className="rps-vs-center">
            {roundResult
              ? roundResult === 'win'  ? '🏆'
              : roundResult === 'lose' ? '💫'
              : '🤝'
              : '⚔️'
            }
          </div>

          <div className={`rps-combatant rps-combatant--manor${roundResult ? ` rps-combatant--${roundResult === 'win' ? 'lose' : roundResult === 'lose' ? 'win' : 'draw'}` : ''}`}>
            <div className="rps-hand rps-hand--manor">
              {phase === 'choosing' ? '🤛' : (manorLabel?.icon ?? '❓')}
            </div>
            <span className="rps-hand-label">{phase === 'choosing' ? 'Ready…' : (manorLabel?.label ?? '')}</span>
          </div>
        </div>

        {/* Round result label */}
        {roundResult && phase === 'revealing' && (
          <p className={`rps-round-result rps-round-result--${roundResult}`}>
            {roundResult === 'win' ? 'You win the round!' : roundResult === 'lose' ? 'Manor wins the round!' : 'Draw!'}
          </p>
        )}

        {/* Choice buttons */}
        {phase === 'choosing' && (
          <div className="rps-choices">
            {CHOICES.map(choice => (
              <button
                key={choice.id}
                className="rps-choice-btn"
                onClick={() => handleChoice(choice.id)}
              >
                <span className="rps-choice-icon">{choice.icon}</span>
                <span className="rps-choice-label">{choice.label}</span>
              </button>
            ))}
          </div>
        )}

        {phase === 'revealing' && !roundResult && (
          <p className="rps-wait">Revealing…</p>
        )}
      </main>

      {/* Game over overlay */}
      {phase === 'finished' && (
        <div className="game-result-overlay">
          <div className="game-result-panel">
            <span className="game-result-icon">{gameWinner === 'player' ? '🏆' : '💫'}</span>
            <h2 className="game-result-title">
              {gameWinner === 'player' ? 'Victory!' : 'Defeated…'}
            </h2>
            <p className="game-result-body">
              {gameWinner === 'player'
                ? `You beat ${challenger}!`
                : `${challenger} wins this round.`}
            </p>
            {gameWinner === 'player' && (
              <p className="game-result-coins">+{coinsEarned} 🪙 coins earned</p>
            )}
            <div className="game-result-btns">
              <button className="game-result-btn game-result-btn--primary" onClick={resetGame}>
                Play Again
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
