import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getActiveProfile, clearActiveProfile, PORTRAITS, profileKey } from '../data/profiles';
import StoryLetter from '../components/StoryLetter';
import { getBattlesWon, checkMilestones, getStoryFlag, setStoryFlag, setJournalPages, isTutorialComplete, setTutorialComplete } from '../data/gameProgress';
import AudioManager from '../audio/AudioManager';
import './ManorMap.css';

// ── Story content ─────────────────────────────────────────────────────────────

const JOURNAL_PAGE_2 = {
  icon: '📖',
  title: "Argon's Journal — Day 12",
  subtitle: "A New Beginning",
  paragraphs: [
    "The manor is more than I dared hope. Forty acres of woodland, a garden already overgrown with the most extraordinary specimens, and a laboratory that needs only a firm hand and fresh glass.",
    "I unpacked my field journals first. Then the specimen cases. Then the kettle — priorities must be observed.",
    "This will be the place. I can feel it. Whatever the creatures truly are, whatever they come from — I will find the answer here.",
    "— A.",
  ],
};

// ── Room data ─────────────────────────────────────────────────────────────────
// top / left / width / height are percentages RELATIVE TO THE IMAGE itself,
// not the container. The imgBounds calculation converts them to pixel positions
// that account for object-fit:contain letterboxing on any screen size.

const ROOMS = [
  {
    id: 'menagerie',
    name: 'The Menagerie Garden',
    description: 'Browse your creature collection',
    top: '19.6%', left: '2.7%', width: '94%', height: '18.5%',
    path: '/menagerie',
    icon: '🌿',
  },
  {
    id: 'lab',
    name: 'The Lab',
    description: 'Create new creatures',
    top: '38.3%', left: '2.2%', width: '35%', height: '12%',
    path: '/lab',
    icon: '⚗️',
  },
  {
    id: 'study',
    name: 'The Study',
    description: "Read Uncle Argon's journals",
    top: '38.8%', left: '61.8%', width: '35%', height: '12%',
    path: '/study',
    icon: '📖',
  },
  {
    id: 'parlor',
    name: 'The Parlor',
    description: 'Trade with visiting villagers',
    top: '50.4%', left: '2.4%', width: '35%', height: '13.5%',
    path: '/parlor',
    icon: '🏪',
  },
  {
    id: 'arena',
    name: 'The Arena',
    description: 'Battle challengers!',
    top: '50.6%', left: '62.2%', width: '35%', height: '13.5%',
    path: '/arena',
    icon: '⚔️',
  },
];

const TRAPDOOR_ROOM = {
  id:          'basement',
  name:        'The Trapdoor',
  description: 'A hidden entrance beneath the hallway rug',
  top:         '44%',
  left:        '37%',
  width:       '13%',
  height:      '16%',
  path:        '/basement',
  icon:        '🚪',
};

// ── Tutorial steps ────────────────────────────────────────────────────────────
// roomId must match a ROOMS entry. null on the final step = no spotlight.

const TUTORIAL_STEPS = [
  {
    roomId: 'lab',
    text: "This is the Lab. Create your first creature here — give it a name, choose its type, and set its stats.",
  },
  {
    roomId: 'menagerie',
    text: "This is your Menagerie Garden. All the creatures you create and collect will live here.",
  },
  {
    roomId: 'arena',
    text: "This is the Arena. Battle your creatures against challengers to earn coins and level up.",
  },
  {
    roomId: 'parlor',
    text: "This is the Parlour. Visit Mira to buy and sell creatures, and talk to the locals for tips and secrets.",
  },
  {
    roomId: 'study',
    text: "Uncle Argon's Study. His library holds the secrets of this manor — explore it when you're ready.",
  },
  {
    roomId: null,
    text: "Start by visiting the Lab to create your first creature. The manor has many secrets to discover… in time.",
  },
];

// ── Manor-handled milestone IDs ───────────────────────────────────────────────
// Parlor events (mira-bully-quest, old-wren-appears) are handled inside Parlor.jsx.

const MANOR_EVENTS = new Set(['lawyer-letter', 'ransack-event', 'final-letter']);

// ── Image-bounds helper ───────────────────────────────────────────────────────
// Given the container size and the image's natural size, returns the pixel
// rect of the rendered image within the container (object-fit:contain).

function calcImgBounds(containerW, containerH, natW, natH) {
  const imgAspect       = natW / natH;
  const containerAspect = containerW / containerH;
  let renderedW, renderedH, offsetX, offsetY;
  if (imgAspect > containerAspect) {
    // Image is wider relative to its height → constrained by container width
    renderedW = containerW;
    renderedH = containerW / imgAspect;
    offsetX   = 0;
    offsetY   = (containerH - renderedH) / 2;
  } else {
    // Image is taller relative to its width → constrained by container height
    renderedH = containerH;
    renderedW = containerH * imgAspect;
    offsetX   = (containerW - renderedW) / 2;
    offsetY   = 0;
  }
  return { offsetX, offsetY, renderedW, renderedH };
}

// Convert image-relative % values for one room into pixel style coords.
function roomToPixels(room, bounds) {
  return {
    top:    `${bounds.offsetY + (parseFloat(room.top)    / 100) * bounds.renderedH}px`,
    left:   `${bounds.offsetX + (parseFloat(room.left)   / 100) * bounds.renderedW}px`,
    width:  `${(parseFloat(room.width)  / 100) * bounds.renderedW}px`,
    height: `${(parseFloat(room.height) / 100) * bounds.renderedH}px`,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ManorMap() {
  const navigate      = useNavigate();
  const activeProfile = getActiveProfile();
  const portrait      = PORTRAITS[activeProfile?.portrait ?? 0];

  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [clickedRoom, setClickedRoom] = useState(null);

  // ── Hotspot editor (active only when ?edit=1 is in the URL) ──────────────
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === '1';

  const [editPositions, setEditPositions] = useState(() =>
    Object.fromEntries([...ROOMS, TRAPDOOR_ROOM].map(r => [
      r.id, { top: r.top, left: r.left, width: r.width, height: r.height },
    ]))
  );
  const draggingRef   = useRef(null);
  const hotspotRefs   = useRef({});
  const [editReady,   setEditReady]   = useState(false);
  const [panelOpen,   setPanelOpen]   = useState(false);

  useEffect(() => {
    AudioManager.playMusic('/sounds/main-screen.mp3');
    return () => AudioManager.stopMusic();
  }, []);

  // ── Image-bounds tracking ─────────────────────────────────────────────────
  // Measures where manor.png actually renders inside the container after
  // object-fit:contain is applied.  Re-runs whenever the window resizes so
  // hotspot positions stay locked to the image on orientation change, etc.

  const imageRef   = useRef(null);
  const [imgBounds, setImgBounds] = useState(null);

  useLayoutEffect(() => {
    function measure() {
      const img       = imageRef.current;
      const container = mapContainerRef.current;
      if (!img || !container || !img.naturalWidth || !img.naturalHeight) return;
      const bounds = calcImgBounds(
        container.clientWidth,
        container.clientHeight,
        img.naturalWidth,
        img.naturalHeight,
      );
      setImgBounds(bounds);
    }

    const img = imageRef.current;
    if (img) {
      if (img.complete && img.naturalWidth) {
        measure();
      } else {
        img.addEventListener('load', measure);
      }
    }
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      img?.removeEventListener('load', measure);
    };
  }, []); // eslint-disable-line

  // When edit mode activates, seed editPositions from the actual DOM positions so
  // dragging starts from exactly where CSS placed each hotspot.
  // The trapdoor is CSS-rotated (getBoundingClientRect swaps its w/h), so we
  // keep its logical values from TRAPDOOR_ROOM instead of measuring it.
  useLayoutEffect(() => {
    if (!isEditMode || !mapContainerRef.current) return;
    const cRect = mapContainerRef.current.getBoundingClientRect();
    setEditPositions(prev => {
      const next = { ...prev };
      ROOMS.forEach(r => {
        const el = hotspotRefs.current[r.id];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        next[r.id] = {
          top:    ((rect.top  - cRect.top)  / cRect.height * 100).toFixed(1) + '%',
          left:   ((rect.left - cRect.left) / cRect.width  * 100).toFixed(1) + '%',
          width:  (rect.width  / cRect.width  * 100).toFixed(1) + '%',
          height: (rect.height / cRect.height * 100).toFixed(1) + '%',
        };
      });
      next[TRAPDOOR_ROOM.id] = {
        top: TRAPDOOR_ROOM.top, left: TRAPDOOR_ROOM.left,
        width: TRAPDOOR_ROOM.width, height: TRAPDOOR_ROOM.height,
      };
      return next;
    });
    setEditReady(true);
  }, [isEditMode]);

  // Window-level drag handler for move, avoiding stale closures via draggingRef.
  useEffect(() => {
    if (!isEditMode) return;

    function onMouseMove(e) {
      const d = draggingRef.current;
      if (!d) return;
      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;
      const newTop  = Math.max(0, Math.min(99, ((d.startTopPx  + dy) / d.containerH) * 100));
      const newLeft = Math.max(0, Math.min(99, ((d.startLeftPx + dx) / d.containerW) * 100));
      setEditPositions(prev => ({
        ...prev,
        [d.roomId]: { ...prev[d.roomId], top: newTop.toFixed(1) + '%', left: newLeft.toFixed(1) + '%' },
      }));
    }

    function onMouseUp() {
      draggingRef.current = null;
      document.body.style.cursor = '';
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [isEditMode]);

  // ── Story events ─────────────────────────────────────────────────────────

  const [eventQueue,          setEventQueue]          = useState([]);
  const [activeEvent,         setActiveEvent]          = useState(null);
  const [showLawyerJournal,   setShowLawyerJournal]    = useState(false);
  const [showRansackPainting, setShowRansackPainting]  = useState(false);
  const [showRansackJournal,  setShowRansackJournal]   = useState(false);
  const [showFinalEnding,     setShowFinalEnding]      = useState(false);
  const [trapdoorVisible,     setTrapdoorVisible]      = useState(
    () => getStoryFlag('ransack-triggered') && !getStoryFlag('basement-discovered')
  );

  useEffect(() => {
    let fromSession = [];
    try {
      const raw = sessionStorage.getItem('pending-milestones');
      if (raw) { fromSession = JSON.parse(raw); sessionStorage.removeItem('pending-milestones'); }
    } catch { /* ignore */ }

    const live   = checkMilestones();
    const merged = [...new Set([...fromSession, ...live])].filter(id => MANOR_EVENTS.has(id));

    if (merged.length > 0) {
      setActiveEvent(merged[0]);
      setEventQueue(merged.slice(1));
    }
  }, []); // eslint-disable-line

  function advanceQueue(currentQueue) {
    if (currentQueue.length > 0) {
      const [next, ...rest] = currentQueue;
      setEventQueue(rest);
      setActiveEvent(next);
    } else {
      setEventQueue([]);
      setActiveEvent(null);
    }
  }

  function handleLawyerLetterClose() { setShowLawyerJournal(true); }

  function handleJournalPage2Close() {
    setStoryFlag('lawyer-letter-delivered', true);
    setJournalPages(2);
    setShowLawyerJournal(false);
    setActiveEvent(null);
    advanceQueue(eventQueue);
  }

  function handleRansackClose() {
    setStoryFlag('ransack-triggered', true);
    setJournalPages(5);
    setTrapdoorVisible(true);
    setShowRansackPainting(false);
    setShowRansackJournal(false);
    setActiveEvent(null);
    advanceQueue(eventQueue);
  }

  function handleFinalLetterComplete() {
    setStoryFlag('final-letter-delivered', true);
    setShowFinalEnding(false);
    setActiveEvent(null);
    advanceQueue(eventQueue);
  }

  // ── Tutorial ──────────────────────────────────────────────────────────────

  // Start tutorial only if not already complete AND no creatures (handles migrated profiles)
  const [tutorialStep, setTutorialStep] = useState(() => {
    const done = isTutorialComplete();
    const hasCreatures = (() => {
      try { return JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]').length > 0; }
      catch { return false; }
    })();
    return (done || hasCreatures) ? null : 0;
  });

  // Measured post-commit spotlight rect — updated by useLayoutEffect below
  const [tutSpotRect, setTutSpotRect] = useState(null);

  // Measure the map container once (+ on resize) so we can compute spotlight positions
  const mapContainerRef = useRef(null);
  const [containerRect, setContainerRect] = useState(null);

  useLayoutEffect(() => {
    function measure() {
      if (mapContainerRef.current) {
        setContainerRect(mapContainerRef.current.getBoundingClientRect());
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  function advanceTutorial() {
    if (tutorialStep === null) return;
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
      completeTutorial();
    } else {
      setTutorialStep(s => s + 1);
    }
  }

  function completeTutorial() {
    setTutorialComplete();
    setTutorialStep(null);
  }

  // Measure the spotlight rect AFTER the DOM commits imgBounds pixel positions.
  // useLayoutEffect runs post-commit, so getBoundingClientRect() returns accurate values.
  useLayoutEffect(() => {
    const tutActive = tutorialStep !== null;
    const roomId    = tutActive ? TUTORIAL_STEPS[tutorialStep]?.roomId : null;
    setTutSpotRect(roomId ? getSpotlightRect(roomId) : null);
  }, [imgBounds, tutorialStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Return the fixed-position bounding rect for a room's hotspot element.
  // Reads from the live DOM element — accurate once imgBounds has positioned hotspots.
  function getSpotlightRect(roomId) {
    if (!roomId) return null;
    const el = hotspotRefs.current[roomId];
    if (el) {
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
    // Fallback: estimate from container + imgBounds (used only before elements mount)
    if (!containerRect) return null;
    const room = ROOMS.find(r => r.id === roomId);
    if (!room) return null;
    if (imgBounds) {
      const cRect = mapContainerRef.current?.getBoundingClientRect();
      if (!cRect) return null;
      return {
        top:    cRect.top  + imgBounds.offsetY + (parseFloat(room.top)    / 100) * imgBounds.renderedH,
        left:   cRect.left + imgBounds.offsetX + (parseFloat(room.left)   / 100) * imgBounds.renderedW,
        width:  (parseFloat(room.width)  / 100) * imgBounds.renderedW,
        height: (parseFloat(room.height) / 100) * imgBounds.renderedH,
      };
    }
    return {
      top:    containerRect.top    + (parseFloat(room.top)    / 100) * containerRect.height,
      left:   containerRect.left   + (parseFloat(room.left)   / 100) * containerRect.width,
      width:  (parseFloat(room.width)  / 100) * containerRect.width,
      height: (parseFloat(room.height) / 100) * containerRect.height,
    };
  }

  // Pre-compute tutorial overlay data so the JSX stays readable
  const tutActive   = tutorialStep !== null;
  const tutStepData = tutActive ? TUTORIAL_STEPS[tutorialStep] : null;
  const tutIsLast   = tutorialStep === TUTORIAL_STEPS.length - 1;

  const tutTooltipPos = (() => {
    if (!tutActive) return null;
    // Final step: no spotlight — center the tooltip in the viewport
    if (!tutSpotRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const VH = window.innerHeight;
    const VW = window.innerWidth;
    const TOOLTIP_W = Math.min(300, VW - 24);
    const isUpperHalf = (tutSpotRect.top + tutSpotRect.height / 2) < VH * 0.55;
    const clampedLeft = Math.max(12, Math.min(VW - TOOLTIP_W - 12,
      tutSpotRect.left + tutSpotRect.width / 2 - TOOLTIP_W / 2));
    return isUpperHalf
      ? { top:    tutSpotRect.top + tutSpotRect.height + 14, left: clampedLeft, width: TOOLTIP_W }
      : { bottom: VH - tutSpotRect.top + 14,                left: clampedLeft, width: TOOLTIP_W };
  })();

  // ── Room navigation ───────────────────────────────────────────────────────

  function handleRoomClick(room) {
    // During tutorial, clicks navigate normally — tutorial tap-catcher sits above
    setClickedRoom(room.id);
    setTimeout(() => navigate(room.path), 400);
  }

  function handleSwitchPlayer() {
    clearActiveProfile();
    navigate('/profile-picker');
  }

  // ── Edit mode drag handlers ───────────────────────────────────────────────

  function handleEditMouseDown(e, roomId) {
    e.preventDefault();
    e.stopPropagation();
    const container = mapContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pos  = editPositions[roomId];
    document.body.style.cursor = 'grabbing';
    draggingRef.current = {
      roomId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTopPx:  parseFloat(pos.top)  / 100 * rect.height,
      startLeftPx: parseFloat(pos.left) / 100 * rect.width,
      containerW:  rect.width,
      containerH:  rect.height,
    };
  }

  function adjustSize(e, roomId, dimension, delta) {
    e.preventDefault();
    e.stopPropagation();
    setEditPositions(prev => {
      const current = parseFloat(prev[roomId][dimension]);
      const min  = dimension === 'width' ? 5 : 3;
      const next = Math.max(min, Math.min(100, current + delta));
      return { ...prev, [roomId]: { ...prev[roomId], [dimension]: next.toFixed(1) + '%' } };
    });
  }

  function copyAll() {
    const allRooms = [...ROOMS, ...(trapdoorVisible ? [TRAPDOOR_ROOM] : [])];
    const data = Object.fromEntries(allRooms.map(r => [r.id, editPositions[r.id]]));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).catch(() => {});
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="manor-map no-select">

      {/* Title Banner */}
      <div className="manor-title">
        <div className="manor-title-center">
          <div className="manor-title-ornament">✦</div>
          <h1>Animalian Manor</h1>
          <div className="manor-title-ornament">✦</div>
        </div>

        {activeProfile && (
          <div className="manor-profile-badge">
            <div className="manor-profile-avatar" style={{ background: portrait.bg }}>
              {portrait.emoji}
            </div>
            <div className="manor-profile-info">
              <span className="manor-profile-name">{activeProfile.name}</span>
              <button className="manor-switch-btn" onClick={handleSwitchPlayer}>
                Switch Player
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div
        className="manor-map-container"
        ref={mapContainerRef}
      >
        <img
          ref={imageRef}
          src="/manor.png"
          alt="Animalian Manor Floor Plan"
          className="manor-map-image"
          draggable={false}
        />

        {/* Standard Room Hotspots */}
        {ROOMS.map((room) => {
          const pos = editPositions[room.id];
          // Edit mode uses container-% positions from dragging state.
          // Normal mode uses pixel positions calculated from the actual rendered
          // image bounds — this keeps hotspots aligned on every screen size.
          const hotspotStyle = (isEditMode && editReady)
            ? { top: pos.top, left: pos.left, width: pos.width, height: pos.height }
            : imgBounds
            ? roomToPixels(room, imgBounds)
            : undefined; // CSS class fallback until image loads (sub-frame)

          return (
            <button
              key={room.id}
              ref={el => { hotspotRefs.current[room.id] = el; }}
              className={[
                'room-hotspot',
                `room-hotspot--${room.id}`,
                isEditMode                              ? 'room-hotspot--edit'  : '',
                !isEditMode && hoveredRoom === room.id  ? 'hovered'             : '',
                !isEditMode && clickedRoom === room.id  ? 'clicked'             : '',
              ].join(' ').trim()}
              style={hotspotStyle}
              onMouseEnter={() => { if (!isEditMode) setHoveredRoom(room.id); }}
              onMouseLeave={() => { if (!isEditMode) setHoveredRoom(null); }}
              onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); } : () => handleRoomClick(room)}
              onMouseDown={isEditMode ? (e) => handleEditMouseDown(e, room.id) : undefined}
              aria-label={`Enter ${room.name}`}
            >
              <div className="room-hotspot-label">
                <span className="room-icon">{room.icon}</span>
                <span className="room-name">{room.name}</span>
                {isEditMode && (
                  <div className="edit-size-controls" onMouseDown={e => e.stopPropagation()}>
                    <span className="edit-size-row">
                      <span className="edit-size-label">W</span>
                      <button onClick={e => adjustSize(e, room.id, 'width', -1)}>−</button>
                      <button onClick={e => adjustSize(e, room.id, 'width', +1)}>+</button>
                    </span>
                    <span className="edit-size-row">
                      <span className="edit-size-label">H</span>
                      <button onClick={e => adjustSize(e, room.id, 'height', -1)}>−</button>
                      <button onClick={e => adjustSize(e, room.id, 'height', +1)}>+</button>
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {/* Trapdoor Hotspot — appears after the ransack event */}
        {trapdoorVisible && (() => {
          const pos = editPositions[TRAPDOOR_ROOM.id];
          const hotspotStyle = (isEditMode && editReady)
            ? { top: pos.top, left: pos.left, width: pos.width, height: pos.height }
            : imgBounds
            ? roomToPixels(TRAPDOOR_ROOM, imgBounds)
            : undefined;

          return (
            <button
              ref={el => { hotspotRefs.current[TRAPDOOR_ROOM.id] = el; }}
              className={[
                'room-hotspot room-hotspot--trapdoor room-hotspot--basement',
                isEditMode                                      ? 'room-hotspot--edit'  : '',
                !isEditMode && hoveredRoom === TRAPDOOR_ROOM.id ? 'hovered'             : '',
                !isEditMode && clickedRoom === TRAPDOOR_ROOM.id ? 'clicked'             : '',
              ].join(' ').trim()}
              style={hotspotStyle}
              onMouseEnter={() => { if (!isEditMode) setHoveredRoom(TRAPDOOR_ROOM.id); }}
              onMouseLeave={() => { if (!isEditMode) setHoveredRoom(null); }}
              onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); } : () => handleRoomClick(TRAPDOOR_ROOM)}
              onMouseDown={isEditMode ? (e) => handleEditMouseDown(e, TRAPDOOR_ROOM.id) : undefined}
              aria-label="Examine the trapdoor"
            >
              <div className="room-hotspot-label">
                <span className="room-icon">{TRAPDOOR_ROOM.icon}</span>
                <span className="room-name">{TRAPDOOR_ROOM.name}</span>
                {isEditMode && (
                  <div className="edit-size-controls" onMouseDown={e => e.stopPropagation()}>
                    <span className="edit-size-row">
                      <span className="edit-size-label">W</span>
                      <button onClick={e => adjustSize(e, TRAPDOOR_ROOM.id, 'width', -1)}>−</button>
                      <button onClick={e => adjustSize(e, TRAPDOOR_ROOM.id, 'width', +1)}>+</button>
                    </span>
                    <span className="edit-size-row">
                      <span className="edit-size-label">H</span>
                      <button onClick={e => adjustSize(e, TRAPDOOR_ROOM.id, 'height', -1)}>−</button>
                      <button onClick={e => adjustSize(e, TRAPDOOR_ROOM.id, 'height', +1)}>+</button>
                    </span>
                  </div>
                )}
              </div>
              <span className="room-hotspot-new" aria-hidden>NEW</span>
            </button>
          );
        })()}
      </div>

      {/* Room Info Tooltip (shown at bottom on hover) */}
      <div className={`room-info-bar ${hoveredRoom ? 'visible' : ''}`}>
        {hoveredRoom && (() => {
          const r = [...ROOMS, TRAPDOOR_ROOM].find(r => r.id === hoveredRoom);
          return r ? (
            <>
              <span className="room-info-icon">{r.icon}</span>
              <div className="room-info-text">
                <strong>{r.name}</strong>
                <span>{r.description}</span>
              </div>
              <span className="room-info-tap">Tap to enter →</span>
            </>
          ) : null;
        })()}
      </div>

      {/* ── Story Events ── */}

      <StoryLetter
        visible={activeEvent === 'lawyer-letter' && !showLawyerJournal}
        type="letter"
        icon="📜"
        title="A Letter from Winslow & Associates"
        subtitle="Solicitors to the Argon Estate"
        paragraphs={[
          "Dear heir to the Argon estate,",
          "During our review of your uncle's stored effects at the Larkfield depository, we discovered a loose journal page tucked inside a leather specimen case.",
          "As this appears to be of a personal nature, we are returning it to you herewith.",
          "Please do not hesitate to contact our offices should you require further assistance regarding the estate.",
          "Yours faithfully, — J. Winslow, Esq.",
        ]}
        buttonText="Open Enclosed Page"
        onClose={handleLawyerLetterClose}
      />

      <StoryLetter
        visible={showLawyerJournal}
        type="journal"
        icon={JOURNAL_PAGE_2.icon}
        title={JOURNAL_PAGE_2.title}
        subtitle={JOURNAL_PAGE_2.subtitle}
        paragraphs={JOURNAL_PAGE_2.paragraphs}
        buttonText="Close"
        onClose={handleJournalPage2Close}
      />

      {/* Ransack — Screen 1: Something is Wrong */}
      <StoryLetter
        visible={activeEvent === 'ransack-event' && !showRansackPainting && !showRansackJournal}
        type="narrative"
        icon="💥"
        title="Something is Wrong"
        paragraphs={[
          "You wake to a crash.",
          "Heavy footsteps. The sound of glass breaking somewhere deep in the manor.",
          "By the time you reach the hallway, they are gone.",
          "But the manor is not as you left it. Furniture overturned. Papers scattered. Uncle Argon's things — thrown about as if someone was searching for something specific.",
          "And in the centre of the hallway — the great rug has been dragged aside.",
          "Beneath it, set into the stone floor, is a trapdoor you have never seen before.",
        ]}
        buttonText="Examine the Trapdoor"
        onClose={() => setShowRansackPainting(true)}
      />

      {/* Ransack — Screen 2: Behind the Painting */}
      <StoryLetter
        visible={showRansackPainting}
        type="narrative"
        icon="🖼️"
        title="Behind the Painting"
        paragraphs={[
          "As you survey the damage, you notice a painting has been knocked from the hallway wall.",
          "Behind it, pressed flat against the stone, is a sheet of paper. It was hidden deliberately — tucked into a gap between the frame mount and the wall.",
          "Uncle Argon's handwriting.",
        ]}
        buttonText="Read the Page"
        onClose={() => { setShowRansackPainting(false); setShowRansackJournal(true); }}
      />

      {/* Ransack — Screen 3: Journal Page 5 */}
      <StoryLetter
        visible={showRansackJournal}
        type="journal"
        icon="✦"
        title="Argon's Journal — Day 1,510"
        subtitle="Beneath the Manor"
        paragraphs={[
          "I have built it. A chamber beneath the hallway, accessible only through a trapdoor hidden under the great rug. It took three months of work at night when no one could observe.",
          "The most sensitive materials are stored there now. If anyone finds this room, they know too much already.",
          "I hope it will not be needed. But hope, without preparation, has never been a reliable strategy.",
          "— A.",
        ]}
        buttonText="Close"
        onClose={handleRansackClose}
      />

      {/* Final letter — Screen 1: Winslow's last correspondence */}
      <StoryLetter
        visible={activeEvent === 'final-letter' && !showFinalEnding}
        type="letter"
        icon="📜"
        title="A Final Letter from Winslow & Associates"
        subtitle="Solicitors to the Argon Estate"
        paragraphs={[
          "Dear heir to the Argon estate,",
          "We have now concluded our complete review of your uncle's affairs. All matters pertaining to the manor, its contents, and its grounds are hereby settled.",
          "However, one matter remains unresolved.",
          "A parcel arrived at our offices on the morning after your uncle's disappearance. It bears no return address. The postmark references coordinates that our cartographer was unable to locate on any known map.",
          "We are forwarding it to you under separate cover.",
          "Whatever your uncle was involved in at the end — we trust you will know what to do with it.",
          "With our regards and best wishes,",
          "— J. Winslow, Esq.",
        ]}
        buttonText="Close Letter"
        onClose={() => setShowFinalEnding(true)}
      />

      {/* Final letter — Screen 2: To Be Continued */}
      <StoryLetter
        visible={showFinalEnding}
        type="narrative"
        icon="✦"
        title="To Be Continued…"
        paragraphs={[
          "Uncle Argon is alive.",
          "He is waiting at the source — the place where the first Animalian came into being.",
          "He left you the manor. He left you the creatures. He left you the journal.",
          "Now he needs you to find him.",
          "The coordinates are encoded. The cipher is somewhere in the study.",
          "The next chapter begins soon.",
        ]}
        buttonText="Return to Manor"
        onClose={handleFinalLetterComplete}
      />

      {/* ── Tutorial Overlay ── */}

      {tutActive && (
        <>
          {/*
           * Tap-catcher: transparent fixed layer that intercepts all taps.
           * On the final step (no spotlight) it also provides the dark background.
           */}
          <div
            className={`tut-tap-catcher${!tutSpotRect ? ' tut-tap-catcher--dim' : ''}`}
            onClick={advanceTutorial}
            aria-hidden
          />

          {/*
           * Spotlight: a fixed div sized to match the highlighted room.
           * Its box-shadow (spread=9999px) is what dims the rest of the screen —
           * the element itself is transparent, revealing the room beneath.
           */}
          {tutSpotRect && (
            <div
              key={`spot-${tutorialStep}`}
              className="tut-spotlight"
              style={{
                top:    tutSpotRect.top,
                left:   tutSpotRect.left,
                width:  tutSpotRect.width,
                height: tutSpotRect.height,
              }}
              aria-hidden
            />
          )}

          {/* Tooltip bubble — re-keyed on each step to replay the entrance animation */}
          <div
            key={`tip-${tutorialStep}`}
            className="tut-tooltip"
            style={{ position: 'fixed', zIndex: 202, ...tutTooltipPos }}
          >
            <p className="tut-text">{tutStepData.text}</p>
            <div className="tut-footer">
              <span className="tut-counter">{tutorialStep + 1} / {TUTORIAL_STEPS.length}</span>
              <span className="tut-tap">
                {tutIsLast ? 'Tap to begin →' : 'Tap anywhere to continue →'}
              </span>
            </div>
          </div>

          {/* Skip link */}
          <button
            className="tut-skip"
            onClick={e => { e.stopPropagation(); completeTutorial(); }}
          >
            Skip Tutorial
          </button>
        </>
      )}

      {/* ── Hotspot Editor Panel (only when ?edit=1) ── */}
      {isEditMode && (
        panelOpen ? (
          <div className="manor-edit-panel">
            <div className="manor-edit-header">
              <span className="manor-edit-title">📐 Hotspot Editor</span>
              <button className="manor-edit-toggle" onClick={() => setPanelOpen(false)}>✕</button>
            </div>
            <div className="manor-edit-rooms">
              {[...ROOMS, ...(trapdoorVisible ? [TRAPDOOR_ROOM] : [])].map(r => {
                const p = editPositions[r.id];
                return (
                  <div key={r.id} className="manor-edit-row">
                    <span className="manor-edit-room-name">{r.icon} {r.id}</span>
                    <span className="manor-edit-vals">
                      top:{p.top} left:{p.left} w:{p.width} h:{p.height}
                    </span>
                  </div>
                );
              })}
            </div>
            <button className="manor-edit-copy" onClick={copyAll}>Copy All</button>
          </div>
        ) : (
          <button className="manor-edit-fab" onClick={() => setPanelOpen(true)}>
            ⚙ Edit
          </button>
        )
      )}

    </div>
  );
}
