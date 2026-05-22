import { useRef, useEffect } from 'react';
import './CreatureCard.css';

// Each creature type: its ink color, emoji icon, and display label
const TYPE_DATA = {
  ember:   { color: '#8B2500', icon: '🔥', label: 'Ember' },
  tide:    { color: '#1B4F72', icon: '🌊', label: 'Tide' },
  thorn:   { color: '#1E5631', icon: '🌿', label: 'Thorn' },
  storm:   { color: '#7D5A00', icon: '⚡', label: 'Storm' },
  phantom: { color: '#4A1942', icon: '🌙', label: 'Phantom' },
  iron:    { color: '#1A1A1A', icon: '⚙️', label: 'Iron' },
};

// Placeholder shown when no image is assigned yet — square SVG
function ArtPlaceholder({ type }) {
  const t = TYPE_DATA[type] || TYPE_DATA.iron;
  return (
    <svg
      className="card-art-placeholder"
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="240" height="240" fill="#FFF8E7" />

      {/* Faint lined-paper effect */}
      {[32, 56, 80, 104, 128, 152, 176, 200].map(y => (
        <line key={y} x1="16" y1={y} x2="224" y2={y}
          stroke={t.color} strokeWidth="0.4" opacity="0.12" />
      ))}

      {/* Corner botanical ornaments */}
      <text x="10"  y="18"  fontSize="15" opacity="0.3" fill={t.color}>❧</text>
      <text x="230" y="18"  fontSize="15" opacity="0.3" fill={t.color} textAnchor="end">❧</text>
      <text x="10"  y="234" fontSize="15" opacity="0.3" fill={t.color}>❦</text>
      <text x="230" y="234" fontSize="15" opacity="0.3" fill={t.color} textAnchor="end">❦</text>

      {/* Dashed circular specimen mount */}
      <ellipse cx="120" cy="112" rx="70" ry="70"
        fill="none" stroke={t.color} strokeWidth="1.5" opacity="0.35" strokeDasharray="5 3"
      />

      {/* Large type icon */}
      <text x="120" y="120" fontSize="56" textAnchor="middle" dominantBaseline="middle" opacity="0.55">
        {t.icon}
      </text>

      {/* Italic label */}
      <text x="120" y="228" fontSize="9" textAnchor="middle" fill={t.color}
        opacity="0.4" fontStyle="italic" fontFamily="Georgia, serif">
        — specimen art pending —
      </text>
    </svg>
  );
}

/**
 * CreatureCard — displays one creature as a Victorian naturalist trading card.
 *
 * Props:
 *   creature           — { name, type, hp, currentHp, image, attacks, atk, def, spd,
 *                          imagePosition, imageColor, imageColorStrength, imageHue }
 *   imagePosition      — { x: 0–100, y: 0–100 }  pan position (overrides creature.imagePosition)
 *   imageColor         — CSS color string for mix-blend-mode:color overlay (overrides creature.imageColor)
 *   imageColorStrength — 0–100  opacity of the color overlay (overrides creature.imageColorStrength)
 *   imageHue           — 0–360  legacy hue-rotate fallback (overrides creature.imageHue)
 *   onArtDrag          — optional callback(dx, dy)  enables drag-to-reframe on the art window
 */
export default function CreatureCard({
  creature,
  imagePosition,
  imageColor,
  imageColorStrength,
  imageHue,
  onArtDrag,
}) {
  const {
    name,
    type = 'iron',
    dualType,
    isLegendary,
    hp,
    currentHp,
    image,
    attacks = [],
    atk,
    def,
    spd,
    level = 1,
    xp    = 0,
  } = creature;

  const xpToNext = level * 3;
  const xpPct    = Math.min(100, Math.round((xp / xpToNext) * 100));

  const t  = TYPE_DATA[type]     || TYPE_DATA.iron;
  const dt = dualType ? (TYPE_DATA[dualType] || null) : null;
  const displayHp = currentHp ?? hp;

  // Resolve display props: explicit prop > value saved on the creature object > default
  const resolvedPosition = imagePosition ?? creature.imagePosition ?? { x: 50, y: 50 };
  const resolvedColor    = imageColor    ?? creature.imageColor    ?? null;
  const resolvedStrength = imageColorStrength ?? creature.imageColorStrength ?? 60;
  // Legacy hue-rotate (kept for any creatures saved before the color-swatch update)
  const resolvedHue      = imageHue ?? creature.imageHue ?? 0;

  // Drag tracking via refs — avoids stale-closure issues in the effect
  const isDragging = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });

  // Document-level listeners keep drag working even when pointer leaves the card
  useEffect(() => {
    if (!onArtDrag) return;

    function onMouseMove(e) {
      if (!isDragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      onArtDrag(dx, dy);
    }
    function onMouseUp() { isDragging.current = false; }

    function onTouchMove(e) {
      if (!isDragging.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - lastPos.current.x;
      const dy = touch.clientY - lastPos.current.y;
      lastPos.current = { x: touch.clientX, y: touch.clientY };
      onArtDrag(dx, dy);
    }
    function onTouchEnd() { isDragging.current = false; }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend',  onTouchEnd);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend',  onTouchEnd);
    };
  }, [onArtDrag]);

  function handleArtMouseDown(e) {
    e.preventDefault();
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }
  function handleArtTouchStart(e) {
    isDragging.current = true;
    const touch = e.touches[0];
    lastPos.current = { x: touch.clientX, y: touch.clientY };
  }

  const imgStyle = {
    objectPosition: `${resolvedPosition.x}% ${resolvedPosition.y}%`,
    // Only fall back to legacy hue-rotate when no new color overlay is set
    ...(!resolvedColor && resolvedHue ? { filter: `hue-rotate(${resolvedHue}deg)` } : {}),
  };

  return (
    <div className="creature-card" style={{ '--type-color': t.color }}>

      {/* ── Header Bar: name + HP ── */}
      <div className="card-header">
        <span className="card-name">{name}</span>
        <span className="card-hp">
          <span className="card-hp-label">HP </span>
          {displayHp}
        </span>
      </div>

      {/* ── Art Window — square, with type badge + drag hint overlaid ── */}
      <div
        className={`card-art-window${onArtDrag ? ' card-art-draggable' : ''}`}
        style={resolvedColor ? { isolation: 'isolate' } : undefined}
        onMouseDown={onArtDrag ? handleArtMouseDown : undefined}
        onTouchStart={onArtDrag ? handleArtTouchStart : undefined}
      >
        {image
          ? <img src={image} alt={name} className="card-art-image" style={imgStyle} draggable={false} />
          : <ArtPlaceholder type={type} />
        }

        {/* Color tint overlay — mix-blend-mode:color leaves white pixels white
            because the 'color' mode preserves the base image's luminosity. */}
        {resolvedColor && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: resolvedColor,
            mixBlendMode: 'color',
            opacity: resolvedStrength / 100,
            pointerEvents: 'none',
          }} />
        )}

        {/* Type badge(s) float over the bottom-left of the art */}
        {dt ? (
          <div className="card-type-badges">
            <div className="card-type-badge" style={{ background: t.color }}>
              <span className="card-type-icon">{t.icon}</span>
              <span className="card-type-label">{t.label}</span>
            </div>
            <div className="card-type-badge" style={{ background: dt.color }}>
              <span className="card-type-icon">{dt.icon}</span>
              <span className="card-type-label">{dt.label}</span>
            </div>
          </div>
        ) : (
          <div className="card-type-badge" style={{ background: t.color }}>
            <span className="card-type-icon">{t.icon}</span>
            <span className="card-type-label">{t.label}</span>
          </div>
        )}

        {/* Drag hint — only in edit mode */}
        {onArtDrag && (
          <div className="card-art-drag-hint">drag to reframe</div>
        )}
      </div>

      {/* ── Legendary Badge ── */}
      {isLegendary && (
        <div className="card-legendary-strip">
          <span className="card-legendary-badge">✦ Legendary</span>
        </div>
      )}

      {/* ── Attack Slots (up to 2) ── */}
      <div className="card-attacks">
        {attacks.slice(0, 2).map((attack, i) => (
          <div key={i} className="card-attack-row" style={{ borderLeftColor: t.color }}>
            <span className="attack-icon">{t.icon}</span>
            <span className="attack-name">{attack.name}</span>
            <span className="attack-damage">{attack.damage}</span>
          </div>
        ))}
      </div>

      {/* ── Stats Bar: ATK / DEF / SPD ── */}
      {/* Legendary creatures intentionally exceed standard stat caps (HP 200, ATK/DEF/SPD 100) — this is by design. */}
      <div className="card-stats-bar">
        <div className="card-stat">
          <span className="stat-label">ATK</span>
          <span className="stat-value">{atk}</span>
        </div>
        <div className="card-stat-divider" />
        <div className="card-stat">
          <span className="stat-label">DEF</span>
          <span className="stat-value">{def}</span>
        </div>
        <div className="card-stat-divider" />
        <div className="card-stat">
          <span className="stat-label">SPD</span>
          <span className="stat-value">{spd}</span>
        </div>
        {level > 1 && (
          <>
            <div className="card-stat-divider" />
            <div className="card-stat card-stat--level">
              <span className="stat-level-stars">{'⭐'.repeat(Math.min(5, level - 1))}</span>
              <span className="stat-label stat-label--level">Lv {level}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Level / XP Bar ── */}
      <div className="card-level-bar">
        <span className="card-level-label">LV {level}</span>
        <div className="card-xp-track">
          <div className="card-xp-fill" style={{ width: `${xpPct}%` }} />
        </div>
        <span className="card-xp-text">{xp} / {xpToNext}</span>
      </div>

    </div>
  );
}
