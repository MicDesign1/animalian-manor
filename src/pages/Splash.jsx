import { useNavigate } from 'react-router-dom';
import AudioManager from '../audio/AudioManager';
import './Splash.css';

export default function Splash() {
  const navigate = useNavigate();

  function enter() {
    const next = sessionStorage.getItem('splash-next') || '/manor';
    sessionStorage.removeItem('splash-next');
    AudioManager.playMusic('/sounds/main-screen.mp3');
    navigate(next, { replace: true });
  }

  return (
    <div className="splash-root">
      <div className="splash-content">
        <h1 className="splash-title">Animalian Manor</h1>
        <p className="splash-subtitle">From the estate of Uncle Argon</p>

        <div className="splash-illustration" aria-hidden="true">🗝️</div>

        <button className="splash-enter-btn" onClick={enter}>
          Enter the Manor →
        </button>
      </div>

      <footer className="splash-footer">
        v0.1 — by the Animalian Manor team
      </footer>
    </div>
  );
}
