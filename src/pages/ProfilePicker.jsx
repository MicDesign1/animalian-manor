import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProfiles,
  setActiveProfile,
  getProfileCreatureCount,
  deleteProfile,
  PORTRAITS,
} from '../data/profiles';
import './ProfilePicker.css';

export default function ProfilePicker() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState(() => getProfiles());
  // Name of the profile pending deletion, or null if no dialog open.
  const [confirmDelete, setConfirmDelete] = useState(null);

  function handleSelect(profile) {
    setActiveProfile(profile.name);
    navigate('/manor');
  }

  function handleDeleteClick(e, profileName) {
    e.stopPropagation(); // don't trigger handleSelect on the card
    setConfirmDelete(profileName);
  }

  function handleConfirmDelete() {
    deleteProfile(confirmDelete);
    setProfiles(getProfiles());
    setConfirmDelete(null);
  }

  function handleReplayIntro() {
    navigate('/intro');
  }

  const pendingProfile = confirmDelete
    ? profiles.find(p => p.name === confirmDelete)
    : null;

  return (
    <div className="picker-page">

      <div className="picker-header">
        <div className="picker-ornament">✦</div>
        <h1 className="picker-heading">Who's Playing?</h1>
        <div className="picker-ornament">✦</div>
      </div>
      <p className="picker-sub">Select your profile to enter the Manor</p>

      <div className="picker-list">
        {profiles.map(profile => {
          const portrait      = PORTRAITS[profile.portrait ?? 0];
          const creatureCount = getProfileCreatureCount(profile.name);
          return (
            <button
              key={profile.name}
              className="profile-card"
              onClick={() => handleSelect(profile)}
            >
              <div className="profile-card-portrait" style={{ background: portrait.bg }}>
                {portrait.emoji}
              </div>

              <div className="profile-card-info">
                <span className="profile-card-name">{profile.name}</span>
                <span className="profile-card-title">
                  {profile.title === 'niece' ? 'Niece' : 'Nephew'} of Uncle Argon
                </span>
              </div>

              <div className="profile-card-badge">
                <span className="profile-badge-num">{creatureCount}</span>
                <span className="profile-badge-lbl">creatures</span>
              </div>

              <button
                className="profile-delete-btn"
                title="Delete this profile"
                onClick={e => handleDeleteClick(e, profile.name)}
                aria-label={`Delete ${profile.name}`}
              >
                ✕
              </button>
            </button>
          );
        })}
      </div>

      <button className="picker-add-btn" onClick={() => navigate('/create-player')}>
        ✦ &nbsp;Add New Player
      </button>

      <button className="picker-intro-btn" onClick={handleReplayIntro}>
        📜 &nbsp;Watch Uncle's Letter Again
      </button>

      {/* ── Delete confirmation modal ── */}
      {confirmDelete && (
        <div className="picker-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="picker-modal" onClick={e => e.stopPropagation()}>
            <div className="picker-modal-seal">⚠</div>
            <h2 className="picker-modal-title">Are You Certain?</h2>
            <p className="picker-modal-body">
              Deleting <strong>{confirmDelete}</strong>'s profile will permanently remove
              their creatures, coins, and all progress. This cannot be undone.
            </p>
            {pendingProfile && getProfileCreatureCount(confirmDelete) > 0 && (
              <p className="picker-modal-warning">
                {getProfileCreatureCount(confirmDelete)} creature
                {getProfileCreatureCount(confirmDelete) !== 1 ? 's' : ''} will be lost forever.
              </p>
            )}
            <div className="picker-modal-buttons">
              <button className="picker-modal-cancel" onClick={() => setConfirmDelete(null)}>
                Keep Profile
              </button>
              <button className="picker-modal-confirm" onClick={handleConfirmDelete}>
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
