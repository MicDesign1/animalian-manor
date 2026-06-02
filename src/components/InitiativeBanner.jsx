import { useState, useEffect } from 'react';
import './InitiativeBanner.css';

export default function InitiativeBanner({ roll }) {
  const [display, setDisplay] = useState(null);
  const [pFace, setPFace]     = useState(1);
  const [eFace, setEFace]     = useState(1);
  const [settled, setSettled] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!roll) return;
    setDisplay(roll); setSettled(false); setLeaving(false);

    const flicker = setInterval(() => {
      setPFace(Math.floor(Math.random() * 20) + 1);
      setEFace(Math.floor(Math.random() * 20) + 1);
    }, 60);
    const settle = setTimeout(() => {
      clearInterval(flicker);
      setPFace(roll.pRoll); setEFace(roll.eRoll); setSettled(true);
    }, 700);
    const leave = setTimeout(() => setLeaving(true), 2200);
    const hide  = setTimeout(() => setDisplay(null), 2700);

    return () => { clearInterval(flicker); clearTimeout(settle); clearTimeout(leave); clearTimeout(hide); };
  }, [roll?.id]);

  if (!display) return null;
  const playerWon = display.playerFirst;

  return (
    <div className={`init-banner ${leaving ? 'init-banner--leaving' : ''}`}>
      <div className="init-banner-title">🎲 Initiative Roll</div>
      <div className="init-banner-row">
        <div className={`init-die-block ${settled && playerWon ? 'init-die-block--winner' : ''}`}>
          <div className="init-die-name">{display.playerName}</div>
          <div className="init-die">{pFace}</div>
          <div className="init-die-math">
            {settled ? `${display.pRoll} + ${display.pMod} = ` : ''}
            <span className="init-die-total">{settled ? display.pTotal : '?'}</span>
          </div>
        </div>
        <div className="init-vs">vs</div>
        <div className={`init-die-block ${settled && !playerWon ? 'init-die-block--winner' : ''}`}>
          <div className="init-die-name">{display.enemyName}</div>
          <div className="init-die">{eFace}</div>
          <div className="init-die-math">
            {settled ? `${display.eRoll} + ${display.eMod} = ` : ''}
            <span className="init-die-total">{settled ? display.eTotal : '?'}</span>
          </div>
        </div>
      </div>
      {settled && (
        <div className="init-banner-result">
          ⚔️ {playerWon ? display.playerName : display.enemyName} moves first!
        </div>
      )}
    </div>
  );
}
