import { useEffect, useRef } from 'react';
import AudioManager from '../audio/AudioManager';
import './StoryLetter.css';

// Full-screen narrative overlay for letters, journal pages, and story events.
// Matches the aesthetic of the intro letter the player sees at first launch.
export default function StoryLetter({
  visible,
  type = 'letter',        // 'letter' | 'journal' | 'narrative'
  icon,                   // emoji shown large above the title
  title,
  subtitle,               // optional small text below title
  paragraphs = [],        // array of strings, each becomes a <p>
  buttonText = 'Continue',
  onClose,
  secondaryButton,        // optional { text, onClick }
}) {
  // Lock body scroll while the overlay is open
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  // Switch to suspense music for narrative-mode overlays; restore on close.
  const savedTrack = useRef(null);
  useEffect(() => {
    if (!visible || type !== 'narrative') return;
    savedTrack.current = AudioManager.getCurrentTrack();
    AudioManager.playMusic('/sounds/suspense.mp3');
    return () => {
      if (savedTrack.current) AudioManager.playMusic(savedTrack.current);
      else AudioManager.stopMusic();
      savedTrack.current = null;
    };
  }, [visible, type]);

  if (!visible) return null;

  return (
    <div
      className={`sl-overlay sl-overlay--${type}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sl-title"
    >
      <div className={`sl-panel sl-panel--${type}`}>

        {icon && (
          <div className="sl-icon" aria-hidden>{icon}</div>
        )}

        <header className="sl-header">
          <h2 className="sl-title" id="sl-title">{title}</h2>
          {subtitle && <p className="sl-subtitle">{subtitle}</p>}
        </header>

        <div className="sl-rule" aria-hidden>
          <span className="sl-rule-gem">✦</span>
          <span className="sl-rule-line" />
          <span className="sl-rule-gem">✦</span>
        </div>

        <div className="sl-body">
          {paragraphs.map((text, i) => (
            <p key={i} className="sl-paragraph">{text}</p>
          ))}
        </div>

        <div className={`sl-actions${secondaryButton ? ' sl-actions--two' : ''}`}>
          {secondaryButton && (
            <button className="sl-btn sl-btn--secondary" onClick={secondaryButton.onClick}>
              {secondaryButton.text}
            </button>
          )}
          <button className="sl-btn sl-btn--primary" onClick={onClose}>
            {buttonText}
          </button>
        </div>

      </div>
    </div>
  );
}
