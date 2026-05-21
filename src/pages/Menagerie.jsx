import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatureCard from '../components/CreatureCard';
import { profileKey } from '../data/profiles';
import AudioManager from '../audio/AudioManager';
import './Menagerie.css';

// Type order used by the auto-sort button
const TYPE_ORDER = ['ember', 'tide', 'thorn', 'storm', 'phantom', 'iron'];


function loadCreatures() {
  return JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]');
}

// ────────────────────────────────────────────────────────────────────────────

export default function Menagerie() {
  const navigate = useNavigate();

  useEffect(() => { AudioManager.playMusic('/sounds/garden-screen.mp3'); }, []);

  const [creatures,      setCreatures]      = useState(() => loadCreatures());
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Drag-and-drop state
  const [dragIdx,     setDragIdx]     = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function save(updated) {
    setCreatures(updated);
    localStorage.setItem(profileKey('creatures'), JSON.stringify(updated));
  }

  function confirmDelete(id) {
    save(creatures.filter(c => c.id !== id));
    setPendingDeleteId(null);
  }

  function sortByType() {
    const sorted = [...creatures].sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a.type);
      const bi = TYPE_ORDER.indexOf(b.type);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    save(sorted);
  }

  // Move card from fromIdx to toIdx, shifting others along
  function reorder(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const next = [...creatures];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    save(next);
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(e, idx) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Needed so Firefox allows drag
    e.dataTransfer.setData('text/plain', String(idx));
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  }

  function handleDrop(e, idx) {
    e.preventDefault();
    if (dragIdx !== null) reorder(dragIdx, idx);
    setDragIdx(null);
    setDragOverIdx(null);
  }

  function handleDragEnd() {
    setDragIdx(null);
    setDragOverIdx(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="menagerie-page">

      {/* ── Header ── */}
      <header className="menagerie-header">
        <button className="menagerie-back-btn" onClick={() => navigate('/manor')}>
          ← Manor
        </button>
        <div className="menagerie-title-group">
          <span className="menagerie-title-icon">🌿</span>
          <div>
            <h1 className="menagerie-title">The Menagerie Garden</h1>
            <p className="menagerie-subtitle">
              {creatures.length === 0
                ? 'Your collection awaits'
                : `${creatures.length} creature${creatures.length !== 1 ? 's' : ''} in your collection`
              }
            </p>
          </div>
        </div>
        <button className="menagerie-lab-btn" onClick={() => navigate('/lab')}>
          ⚗️ New Creature
        </button>
      </header>

      {/* ── Content ── */}
      <main className="menagerie-main">

        {creatures.length === 0 ? (
          /* ── Empty state ── */
          <div className="menagerie-empty">
            <span className="empty-illustration">🌱</span>
            <h2 className="empty-title">The garden is quiet...</h2>
            <p className="empty-body">
              You haven't created any creatures yet.<br />
              Head to The Lab to bring your first one to life!
            </p>
            <button className="empty-lab-btn" onClick={() => navigate('/lab')}>
              ⚗️ Go to The Lab
            </button>
          </div>
        ) : (
          <>
            {/* ── Toolbar ── */}
            <div className="menagerie-toolbar">
              <span className="menagerie-drag-hint">Drag cards to rearrange</span>
              <button className="sort-type-btn" onClick={sortByType}>
                ✦ Sort by Type
              </button>
            </div>

            {/* ── Card grid ── */}
            <div className="creature-grid">
              {creatures.map((creature, idx) => {
                const isDragging  = dragIdx     === idx;
                const isDragOver  = dragOverIdx === idx && dragIdx !== idx;
                const isConfirm   = pendingDeleteId === creature.id;

                return (
                  <div
                    key={creature.id}
                    className={[
                      'creature-slot',
                      isDragging ? 'creature-slot--dragging'  : '',
                      isDragOver ? 'creature-slot--drag-over' : '',
                    ].join(' ').trim()}
                    draggable={!isConfirm}
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragOver={e  => handleDragOver(e, idx)}
                    onDrop={e      => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                  >
                    <CreatureCard creature={creature} />

                    {/* ✕ button — appears on hover, opens the confirmation overlay */}
                    {!isConfirm && (
                      <button
                        className="release-btn"
                        onClick={() => setPendingDeleteId(creature.id)}
                        title="Remove this creature"
                      >
                        ✕
                      </button>
                    )}

                    {/* Confirmation overlay */}
                    {isConfirm && (
                      <div className="melt-confirm-overlay">
                        <p className="melt-warning-title">🔥 Melt this card?</p>
                        <p className="melt-warning-body">
                          Are you sure you want to melt <strong>{creature.name}</strong>?
                          <br />This is permanent!
                        </p>
                        <div className="melt-confirm-buttons">
                          <button
                            className="melt-yes-btn"
                            onClick={() => confirmDelete(creature.id)}
                          >
                            Yes, melt it
                          </button>
                          <button
                            className="melt-no-btn"
                            onClick={() => setPendingDeleteId(null)}
                          >
                            Keep it
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

      </main>
    </div>
  );
}
