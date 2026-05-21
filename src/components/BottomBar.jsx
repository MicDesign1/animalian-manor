import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { profileKey, getActiveProfile, PORTRAITS } from '../data/profiles';
import SettingsModal from './SettingsModal';
import './BottomBar.css';

// Fullscreen helpers — handles both standard and webkit prefix
const fsAPI = {
  request: () => {
    const el = document.documentElement;
    return (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  },
  exit: () => (document.exitFullscreen || document.webkitExitFullscreen)?.call(document),
  element: () => document.fullscreenElement || document.webkitFullscreenElement,
  supported: () => !!(
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen
  ),
};

// Routes where the HUD should be hidden (pre-game / profile flow)
const HIDE_ON = new Set(['/', '/splash', '/intro', '/profile-picker', '/create-player']);

const ROOM_LABELS = {
  '/manor':    { icon: '🏛️', name: 'Manor' },
  '/lab':      { icon: '⚗️',  name: 'The Lab' },
  '/menagerie':{ icon: '🌿', name: 'Menagerie' },
  '/arena':    { icon: '⚔️',  name: 'Arena' },
  '/study':    { icon: '📖', name: 'Study' },
  '/parlor':   { icon: '🏪', name: 'Parlor' },
};

const QUICK_NAV = [
  { path: '/menagerie', icon: '🌿', label: 'Garden' },
  { path: '/lab',       icon: '⚗️',  label: 'Lab'    },
  { path: '/arena',     icon: '⚔️',  label: 'Arena'  },
];

function readStats() {
  return {
    creatures: JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]').length,
    coins:     Number(localStorage.getItem(profileKey('coins')) || '0'),
  };
}

export default function BottomBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(readStats);
  const [profile, setProfile] = useState(getActiveProfile);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const canFullscreen = fsAPI.supported();

  useEffect(() => {
    setStats(readStats());
    setProfile(getActiveProfile());
  }, [location.pathname]);

  useEffect(() => {
    function onFSChange() { setIsFullscreen(!!fsAPI.element()); }
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fsAPI.element()) fsAPI.exit();
    else fsAPI.request()?.catch(() => {});
  }, []);

  if (HIDE_ON.has(location.pathname)) return null;

  const room = ROOM_LABELS[location.pathname] ?? { icon: '✦', name: 'Animalian Manor' };

  return (
    <>
    <nav className="bottom-bar" aria-label="Game HUD">

      {profile && (
        <>
          <button
            className="bar-player-chip"
            onClick={() => navigate('/profile-picker')}
            title="Switch profile"
          >
            <span className="bar-player-portrait">{PORTRAITS[profile.portrait]?.emoji ?? '🐾'}</span>
            <span className="bar-player-name">{profile.name}</span>
          </button>
          <div className="bar-rule" aria-hidden />
        </>
      )}

      <div className="bar-location">
        <span className="bar-location-icon">{room.icon}</span>
        <span className="bar-location-name">{room.name}</span>
      </div>

      <div className="bar-rule" aria-hidden />

      <div className="bar-stats">
        <button
          className="bar-stat-chip"
          onClick={() => navigate('/menagerie')}
          title="Open Menagerie Garden"
        >
          <span className="bar-stat-icon">🐾</span>
          <span className="bar-stat-value">{stats.creatures}</span>
          <span className="bar-stat-label">creatures</span>
        </button>

        <div className="bar-stat-chip bar-stat-chip--static" title="Your coins">
          <span className="bar-stat-icon">🪙</span>
          <span className="bar-stat-value">{stats.coins}</span>
          <span className="bar-stat-label">coins</span>
        </div>
      </div>

      <div className="bar-rule" aria-hidden />

      <div className="bar-quicknav">
        {QUICK_NAV.map(({ path, icon, label }) => (
          <button
            key={path}
            className={`bar-nav-btn ${location.pathname === path ? 'active' : ''}`}
            onClick={() => navigate(path)}
            title={label}
          >
            <span className="bar-nav-icon">{icon}</span>
            <span className="bar-nav-label">{label}</span>
          </button>
        ))}
      </div>

      {canFullscreen && (
        <>
          <div className="bar-rule" aria-hidden />
          <button
            className="bar-fs-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 1v4H1M11 1v4h4M1 11h4v4M11 11h4v4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4" />
              </svg>
            )}
          </button>
        </>
      )}

      <div className="bar-rule" aria-hidden />
      <button
        className="bar-settings-btn"
        onClick={() => setShowSettings(s => !s)}
        title="Audio settings"
        aria-label="Audio settings"
        aria-expanded={showSettings}
      >
<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
  <path fillRule="evenodd" clipRule="evenodd" d="M13.5 1h-3l-.5 2.6a8.5 8.5 0 00-1.95.81L5.9 2.9 3.78 5.02l1.5 2.15a8.5 8.5 0 00-.81 1.95L1.87 9.62v2.76l2.6.5c.18.69.45 1.34.81 1.95L3.78 16.98l2.12 2.12 2.15-1.5c.61.36 1.26.63 1.95.81L10.5 21h2.76l.5-2.6c.69-.18 1.34-.45 1.95-.81l2.15 1.5 2.12-2.12-1.5-2.15c.36-.61.63-1.26.81-1.95l2.6-.5V9.62l-2.6-.5a8.5 8.5 0 00-.81-1.95L20.22 5.02 18.1 2.9l-2.15 1.5a8.5 8.5 0 00-1.95-.81L13.5 1zM12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm0 2a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
</svg>
      </button>

    </nav>
    {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
