import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createProfile,
  setActiveProfile,
  getProfiles,
  PORTRAITS,
} from '../data/profiles';
import './PlayerCreate.css';

export default function PlayerCreate() {
  const navigate  = useNavigate();
  const [name,     setName]     = useState('');
  const [title,    setTitle]    = useState('nephew');
  const [portrait, setPortrait] = useState(0);
  const [error,    setError]    = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to sign the guest book!');
      return;
    }
    if (getProfiles().find(p => p.name === trimmed)) {
      setError('That name is already in the guest book. Try another!');
      return;
    }
    setError('');
    createProfile({ name: trimmed, title, portrait });
    setActiveProfile(trimmed);
    navigate('/intro');
  }

  return (
    <div className="create-page">
      <div className="create-panel">

        <div className="create-header">
          <span className="create-icon">📜</span>
          <h1 className="create-title">Sign the Guest Book</h1>
          <p className="create-subtitle">Register your arrival at Animalian Manor</p>
        </div>

        <form className="create-form" onSubmit={handleSubmit} noValidate>

          {/* ── Name ── */}
          <div className="create-field">
            <label className="create-label">Your Name</label>
            <input
              className="create-input"
              type="text"
              placeholder="e.g. Thomas, Eleanor, George…"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              autoComplete="off"
              autoFocus
            />
          </div>

          {/* ── Title ── */}
          <div className="create-field">
            <label className="create-label">You are Uncle Argon's…</label>
            <div className="title-pill-row">
              <button
                type="button"
                className={`title-pill ${title === 'nephew' ? 'selected' : ''}`}
                onClick={() => setTitle('nephew')}
              >
                Nephew
              </button>
              <button
                type="button"
                className={`title-pill ${title === 'niece' ? 'selected' : ''}`}
                onClick={() => setTitle('niece')}
              >
                Niece
              </button>
            </div>
          </div>

          {/* ── Portrait ── */}
          <div className="create-field">
            <label className="create-label">Choose Your Portrait</label>
            <div className="portrait-grid">
              {PORTRAITS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={`portrait-btn ${portrait === i ? 'selected' : ''}`}
                  style={{ '--portrait-bg': p.bg }}
                  onClick={() => setPortrait(i)}
                  aria-label={`Portrait ${i + 1}: ${p.emoji}`}
                >
                  {p.emoji}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="create-error" role="alert">{error}</p>}

          <button type="submit" className="create-submit-btn">
            ✦ &nbsp;Begin Your Adventure
          </button>

        </form>
      </div>
    </div>
  );
}
