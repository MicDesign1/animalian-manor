import { useState, useEffect, useRef } from 'react';
import AudioManager from '../audio/AudioManager';
import './SettingsModal.css';

/**
 * Audio settings panel — opened from the BottomBar gear icon.
 * Two volume sliders (music + SFX), mute toggles, and a SFX test button.
 * Changes apply live; no Save button needed — AudioManager persists to localStorage.
 * Closes on: ✕ button, click outside, or Escape key.
 */
export default function SettingsModal({ onClose }) {
  const [musicVol, setMusicVolState] = useState(
    () => Math.round(AudioManager.getMusicVolume() * 100)
  );
  const [sfxVol, setSfxVolState] = useState(
    () => Math.round(AudioManager.getSfxVolume() * 100)
  );

  // Pre-mute values so we can restore on un-mute
  const musicPreMute = useRef(null);
  const sfxPreMute   = useRef(null);

  const musicMuted = musicVol === 0;
  const sfxMuted   = sfxVol   === 0;

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleMusicChange(val) {
    setMusicVolState(val);
    musicPreMute.current = val > 0 ? val : musicPreMute.current;
    AudioManager.setMusicVolume(val / 100);
  }

  function handleSfxChange(val) {
    setSfxVolState(val);
    sfxPreMute.current = val > 0 ? val : sfxPreMute.current;
    AudioManager.setSfxVolume(val / 100);
  }

  function toggleMusicMute() {
    if (musicMuted) {
      const restore = musicPreMute.current ?? 50;
      handleMusicChange(restore);
    } else {
      musicPreMute.current = musicVol;
      handleMusicChange(0);
    }
  }

  function toggleSfxMute() {
    if (sfxMuted) {
      const restore = sfxPreMute.current ?? 70;
      handleSfxChange(restore);
    } else {
      sfxPreMute.current = sfxVol;
      handleSfxChange(0);
    }
  }

  function testSfx() {
    AudioManager.playSfx('/sounds/iron-hit2.mp3');
  }

  return (
    <div
      className="settings-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Audio Settings"
    >
      <div className="settings-panel" onClick={e => e.stopPropagation()}>

        <div className="settings-header">
          <span className="settings-title">Audio Settings</span>
          <button className="settings-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="settings-rule" aria-hidden>
          <span className="settings-rule-gem">✦</span>
          <span className="settings-rule-line" />
          <span className="settings-rule-gem">✦</span>
        </div>

        {/* Music volume row */}
        <div className="settings-row">
          <button
            className={`settings-mute-btn${musicMuted ? ' settings-mute-btn--muted' : ''}`}
            onClick={toggleMusicMute}
            title={musicMuted ? 'Unmute music' : 'Mute music'}
            aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
          >
            {musicMuted ? '🔇' : '🎵'}
          </button>
          <div className="settings-slider-wrap">
            <label className="settings-label" htmlFor="music-vol-slider">
              Music Volume
            </label>
            <div className="settings-slider-row">
              <input
                id="music-vol-slider"
                type="range"
                min="0"
                max="100"
                value={musicVol}
                onChange={e => handleMusicChange(Number(e.target.value))}
                className="settings-slider"
              />
              <span className="settings-vol-pct">{musicVol}%</span>
            </div>
          </div>
        </div>

        {/* SFX volume row */}
        <div className="settings-row">
          <button
            className={`settings-mute-btn${sfxMuted ? ' settings-mute-btn--muted' : ''}`}
            onClick={toggleSfxMute}
            title={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {sfxMuted ? '🔇' : '🔊'}
          </button>
          <div className="settings-slider-wrap">
            <label className="settings-label" htmlFor="sfx-vol-slider">
              Sound Effects
            </label>
            <div className="settings-slider-row">
              <input
                id="sfx-vol-slider"
                type="range"
                min="0"
                max="100"
                value={sfxVol}
                onChange={e => handleSfxChange(Number(e.target.value))}
                className="settings-slider"
              />
              <span className="settings-vol-pct">{sfxVol}%</span>
            </div>
          </div>
          <button
            className="settings-test-btn"
            onClick={testSfx}
            title="Play a test sound effect"
          >
            ▶ Test
          </button>
        </div>

        <div className="settings-rule settings-rule--bottom" aria-hidden>
          <span className="settings-rule-gem">✦</span>
          <span className="settings-rule-line" />
          <span className="settings-rule-gem">✦</span>
        </div>

      </div>
    </div>
  );
}
