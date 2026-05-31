import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatureCard from '../components/CreatureCard';
import { getRandomImage } from '../data/creatureImages';
import { isReservedArt } from '../data/reservedArt';
import { generateCreatureName, generateAttackNames } from '../data/nameGenerator';
import { profileKey } from '../data/profiles';
import { playCreated, playExplosion } from '../utils/sounds';
import AudioManager from '../audio/AudioManager';
import './Lab.css';

// The six creature types with their ink colors and icons
const TYPES = [
  { id: 'ember',   label: 'Ember',   color: '#8B2500', icon: '🔥' },
  { id: 'tide',    label: 'Tide',    color: '#1B4F72', icon: '🌊' },
  { id: 'thorn',   label: 'Thorn',   color: '#1E5631', icon: '🌿' },
  { id: 'storm',   label: 'Storm',   color: '#7D5A00', icon: '⚡' },
  { id: 'phantom', label: 'Phantom', color: '#4A1942', icon: '🌙' },
  { id: 'iron',    label: 'Iron',    color: '#1A1A1A', icon: '⚙️' },
];

// Level 1 budget. Formula: 200 + (level - 1) * 20.
const POOL = 200;

// Color swatches for the art tint picker.
// mix-blend-mode:color preserves white/black luminosity so these never wash out highlights.
const TINT_COLORS = [
  { label: 'None',    value: null,      swatch: null },
  { label: 'Crimson', value: '#C0392B', swatch: '#C0392B' },
  { label: 'Amber',   value: '#E67E22', swatch: '#E67E22' },
  { label: 'Gold',    value: '#F9CA24', swatch: '#F9CA24' },
  { label: 'Forest',  value: '#27AE60', swatch: '#27AE60' },
  { label: 'Teal',    value: '#0097A7', swatch: '#0097A7' },
  { label: 'Ocean',   value: '#1565C0', swatch: '#1565C0' },
  { label: 'Violet',  value: '#6A1B9A', swatch: '#6A1B9A' },
  { label: 'Rose',    value: '#E91E63', swatch: '#E91E63' },
  { label: 'Sepia',   value: '#795548', swatch: '#795548' },
];

// ── Lab energy ────────────────────────────────────────────────────────────────

const LAB_DAILY_MAX          = 5;
const GOLD_RECHARGE_COST     = 50;   // flat cost every time — no daily cap
const EXPLOSION_REPAIR_COST  = 300;  // cost to fix a blown-up lab
const MAX_MINIGAME_TRIES     = 3;    // attempts per overlay session; also the danger cap
const BEAKER_SPEEDS      = [25, 40, 65];
const BEAKER_COLORS      = ['#8B2500', '#1B4F72', '#1E5631'];
const GREEN_MIN = 82;
const GREEN_MAX = 95;

function loadEnergy() {
  const today = new Date().toISOString().slice(0, 10);
  const blank = { used: 0, max: LAB_DAILY_MAX, date: today, danger: 0 };
  try {
    const raw = localStorage.getItem(profileKey('lab-energy'));
    if (!raw) return blank;
    const obj = JSON.parse(raw);
    return obj.date !== today ? blank : { ...blank, ...obj };
  } catch { return blank; }
}
function saveEnergy(e) {
  localStorage.setItem(profileKey('lab-energy'), JSON.stringify(e));
}

// A single stat slider row: label — track — number
// `remaining` clamps the max so the slider can't exceed the budget.
function StatSlider({ label, value, min, max, onChange, typeColor, remaining }) {
  const effectiveMax = (remaining !== undefined && remaining >= 0)
    ? Math.min(max, value + remaining)
    : max;
  const fillPct = ((value - min) / (max - min) * 100).toFixed(1) + '%';
  return (
    <div className="stat-slider-row">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={effectiveMax}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="slider-input"
        style={{ '--fill-color': typeColor, '--fill-pct': fillPct }}
      />
      <span className="slider-value">{value}</span>
    </div>
  );
}

export default function Lab() {
  const navigate  = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => { AudioManager.playMusic('/sounds/lab-screen.mp3'); }, []);

  // ── Form state ──────────────────────────────────────────
  // Names are pre-filled with Victorian naturalist suggestions — all editable
  const [name,    setName]    = useState(() => generateCreatureName('ember'));
  const [type,    setType]    = useState('ember');
  const [attacks, setAttacks] = useState(() => {
    const [a1, a2] = generateAttackNames('ember');
    return [{ name: a1, damage: 20 }, { name: a2, damage: 20 }];
  });

  // Regenerate creature + attack names whenever the creature type is switched.
  // Uses a ref to skip the first render (names already set by the initializers above).
  const firstTypeRender = useRef(true);
  useEffect(() => {
    if (firstTypeRender.current) { firstTypeRender.current = false; return; }
    setName(generateCreatureName(type));
    const [a1, a2] = generateAttackNames(type);
    setAttacks(prev => [
      { ...prev[0], name: a1 },
      { ...prev[1], name: a2 },
    ]);
  }, [type]);

  // Default spread uses exactly 120 free points (POOL=200 minus minimums 80)
  const [hp,  setHp]  = useState(90);
  const [atk, setAtk] = useState(40);
  const [def, setDef] = useState(30);
  const [spd, setSpd] = useState(40);

  // ── Image / art state ───────────────────────────────────
  // Start with a random creature from the library right away
  const [image,         setImage]         = useState(() => getRandomImage());
  const [position,      setPosition]      = useState({ x: 50, y: 50 });
  const [imageColor,    setImageColor]    = useState(null);   // null = no tint
  const [colorStrength, setColorStrength] = useState(60);     // 0-100

  // ── UI feedback ─────────────────────────────────────────
  const [createdCreature, setCreatedCreature] = useState(null); // shown in success overlay
  const [error,           setError]           = useState('');

  // ── Lab energy ───────────────────────────────────────────
  const [energy,             setEnergy]             = useState(() => loadEnergy());
  const [coins,              setCoins]              = useState(() => parseInt(localStorage.getItem(profileKey('coins')) || '0', 10));
  const [showRecharge,       setShowRecharge]       = useState(false);
  const [rechargePhase,      setRechargePhase]      = useState('choose');
  const [minigameActive,     setMinigameActive]     = useState(false);
  const [minigameAllSuccess, setMinigameAllSuccess] = useState(false);
  const [minigameAttempts,   setMinigameAttempts]   = useState(0);
  const [isExploding,        setIsExploding]        = useState(false);

  // Refs so the rAF loop never closes over stale state
  const beakerFillsRef   = useRef([0, 0, 0]);
  const beakerLockedRef  = useRef([false, false, false]);
  const beakerSuccessRef = useRef([false, false, false]);
  const animFrameRef     = useRef(null);
  const prevTimeRef      = useRef(null);
  const energyRef        = useRef(energy);
  useEffect(() => { energyRef.current = energy; }, [energy]);

  const [beakerRender, setBeakerRender] = useState({
    fills: [0, 0, 0], locked: [false, false, false], success: [false, false, false],
  });

  useEffect(() => {
    if (!minigameActive) return;
    prevTimeRef.current = null;

    function animate(time) {
      if (prevTimeRef.current === null) prevTimeRef.current = time;
      const dt = Math.min((time - prevTimeRef.current) / 1000, 0.05);
      prevTimeRef.current = time;

      const newFills = beakerFillsRef.current.map((fill, i) => {
        if (beakerLockedRef.current[i]) return fill;
        let next = fill + BEAKER_SPEEDS[i] * dt;
        if (next >= 100) next = 0; // wrap
        return next;
      });

      beakerFillsRef.current = newFills;
      setBeakerRender(prev => ({ ...prev, fills: [...newFills] }));
      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [minigameActive]);

  // Resets the form to a fresh creature (keeps the current type).
  function resetForm() {
    setName(generateCreatureName(type));
    const [a1, a2] = generateAttackNames(type);
    setAttacks([{ name: a1, damage: 20 }, { name: a2, damage: 20 }]);
    setImage(getRandomImage());
    setPosition({ x: 50, y: 50 });
    setImageColor(null);
    setHp(90);
    setAtk(40);
    setDef(30);
    setSpd(40);
    setError('');
  }

  const typeColor = TYPES.find(t => t.id === type)?.color ?? '#8B2500';

  // Stat point budget
  const pointsUsed = (hp - 50) + (atk - 10) + (def - 10) + (spd - 10);
  const pointsRemaining = POOL - pointsUsed;

  // Attack damage budget — total = ATK × 1.5, individual max = ATK, min = 5
  const dmgPool      = Math.floor(atk * 1.5);
  const dmgUsed      = attacks[0].damage + attacks[1].damage;
  const dmgRemaining = Math.max(0, dmgPool - dmgUsed);

  // Which attack slot (if any) will carry a 2-turn cooldown in battle
  const labStrongIdx = attacks[0].damage !== attacks[1].damage
    ? (attacks[0].damage > attacks[1].damage ? 0 : 1)
    : -1;

  // ── Live preview — built from form state in real time ───
  const previewCreature = {
    name:    name.trim() || 'New Creature',
    type,
    hp,
    image,
    attacks: [
      { name: attacks[0].name || '—', damage: attacks[0].damage },
      { name: attacks[1].name || '—', damage: attacks[1].damage },
    ],
    atk,
    def,
    spd,
  };

  // ── Handlers ────────────────────────────────────────────

  const updateAttack = (i, field, val) =>
    setAttacks(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));

  // Changing ATK adjusts the damage pool — clamp both attacks to stay within it.
  function handleAtkChange(newAtk) {
    setAtk(newAtk);
    const newPool = Math.floor(newAtk * 1.5);
    setAttacks(prev => {
      let a0 = Math.max(5, Math.min(prev[0].damage, newAtk));
      let a1 = Math.max(5, Math.min(prev[1].damage, newAtk));
      if (a0 + a1 > newPool) {
        a1 = Math.max(5, newPool - a0);
        if (a0 + a1 > newPool) a0 = Math.max(5, newPool - a1);
      }
      return [{ ...prev[0], damage: a0 }, { ...prev[1], damage: a1 }];
    });
  }

  // Pick a brand new random creature and reset framing + tint
  function shuffleCreature() {
    setImage(getRandomImage());
    setPosition({ x: 50, y: 50 });
    setImageColor(null);
  }

  // Optional: let the kid upload their own image instead
  const handleImageUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setImage(ev.target.result);
      setPosition({ x: 50, y: 50 });
      setImageColor(null);
    };
    reader.readAsDataURL(file);
  };

  // Called by CreatureCard each drag frame — receives the pixel delta.
  // We convert it to a position percentage (0–100) and clamp it.
  // Negative multiplier = "grab and drag" feel (drag right → image moves right).
  const handleArtDrag = useCallback((dx, dy) => {
    setPosition(prev => ({
      x: Math.max(0, Math.min(100, prev.x - dx * 0.3)),
      y: Math.max(0, Math.min(100, prev.y - dy * 0.3)),
    }));
  }, []);

  // ── Recharge helpers ──────────────────────────────────────
  function startMinigame() {
    beakerFillsRef.current   = [0, 0, 0];
    beakerLockedRef.current  = [false, false, false];
    beakerSuccessRef.current = [false, false, false];
    setBeakerRender({ fills: [0,0,0], locked: [false,false,false], success: [false,false,false] });
    setRechargePhase('minigame');
    setMinigameActive(true);
  }

  function handleBeakerTap(i) {
    if (!minigameActive || beakerLockedRef.current[i]) return;
    const fill    = beakerFillsRef.current[i];
    const success = fill >= GREEN_MIN && fill <= GREEN_MAX;
    beakerLockedRef.current[i]  = true;
    beakerSuccessRef.current[i] = success;
    const newLocked  = [...beakerLockedRef.current];
    const newSuccess = [...beakerSuccessRef.current];
    setBeakerRender(prev => ({ fills: [...prev.fills], locked: newLocked, success: newSuccess }));

    if (newLocked.every(l => l)) {
      setMinigameActive(false);
      cancelAnimationFrame(animFrameRef.current);
      const allOk      = newSuccess.every(s => s);
      setMinigameAllSuccess(allOk);
      const newAttempts = minigameAttempts + 1;
      setMinigameAttempts(newAttempts);

      const cur = energyRef.current;

      if (allOk) {
        // Success — award +2 slots (danger stays where it is, success relieves no stress)
        const updated = { ...cur, max: cur.max + 2 };
        saveEnergy(updated); setEnergy(updated);
        setRechargePhase('result');
      } else {
        // Failed attempt — increment danger meter
        const newDanger = (cur.danger || 0) + 1;
        const updated   = { ...cur, danger: newDanger };
        saveEnergy(updated); setEnergy(updated);

        if (newDanger >= MAX_MINIGAME_TRIES) {
          // Show beakers failed for a moment, then BOOM
          setRechargePhase('result');
          setTimeout(() => {
            playExplosion();
            setIsExploding(true);
            setRechargePhase('explosion');
            setTimeout(() => setIsExploding(false), 900);
          }, 800);
        } else {
          setRechargePhase('result');
        }
      }
    }
  }

  function handleGoldRecharge() {
    if (coins < GOLD_RECHARGE_COST) return;
    const newCoins  = coins - GOLD_RECHARGE_COST;
    const cur       = energyRef.current;
    const newEnergy = { ...cur, max: cur.max + 2 };
    setCoins(newCoins);
    localStorage.setItem(profileKey('coins'), String(newCoins));
    saveEnergy(newEnergy);
    setEnergy(newEnergy);
    setShowRecharge(false);
  }

  function handleRepairLab() {
    if (coins < EXPLOSION_REPAIR_COST) return;
    const newCoins  = coins - EXPLOSION_REPAIR_COST;
    const cur       = energyRef.current;
    // Repair resets danger to 0 AND adds +2 slots as the recharge
    const newEnergy = { ...cur, danger: 0, max: cur.max + 2 };
    setCoins(newCoins);
    localStorage.setItem(profileKey('coins'), String(newCoins));
    saveEnergy(newEnergy);
    setEnergy(newEnergy);
    setShowRecharge(false);
  }

  const handleCreate = e => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give your creature a name first!');
      return;
    }

    // Energy gate — open recharge screen if daily slots are used up
    if (energy.used >= energy.max) {
      setShowRecharge(true);
      setMinigameAttempts(0);
      // If the lab is still destroyed from a prior explosion, skip straight to repair
      setRechargePhase((energy.danger || 0) >= MAX_MINIGAME_TRIES ? 'explosion' : 'choose');
      return;
    }

    setError('');

    // Safety assertion: reserved art must never be saved on a player-created creature.
    const safeImage = isReservedArt(image) ? getRandomImage() : image;

    const creature = {
      id:                 Date.now(),
      name:               name.trim(),
      type,
      hp,
      currentHp:          hp,
      image:              safeImage,
      imagePosition:      position,
      imageColor:         imageColor,
      imageColorStrength: colorStrength,
      attacks:       attacks.map(a => ({ name: a.name, damage: a.damage })),
      atk,
      def,
      spd,
      level:         1,
      xp:            0,
    };

    const existing = JSON.parse(localStorage.getItem(profileKey('creatures')) || '[]');
    localStorage.setItem(profileKey('creatures'), JSON.stringify([...existing, creature]));

    const newEnergy = { ...energy, used: energy.used + 1 };
    saveEnergy(newEnergy);
    setEnergy(newEnergy);

    playCreated();
    setCreatedCreature(creature);
  };

  return (
    <div className="lab-page">

      {/* ── Header bar ── */}
      <header className="lab-header">
        <button className="lab-back-btn" onClick={() => navigate('/manor')}>
          ← Manor
        </button>
        <div className="lab-title-group">
          <span className="lab-title-icon">⚗️</span>
          <h1 className="lab-title">The Lab</h1>
          <span className="lab-title-sub">Uncle Argon's Workshop</span>
        </div>
        <div
          className="lab-energy-meter"
          title={`Lab energy: ${Math.max(0, energy.max - energy.used)} creation slots left`}
          onClick={() => { if (energy.used >= energy.max) { setShowRecharge(true); setMinigameAttempts(0); setRechargePhase((energy.danger || 0) >= MAX_MINIGAME_TRIES ? 'explosion' : 'choose'); } }}
          style={{ cursor: energy.used >= energy.max ? 'pointer' : 'default' }}
        >
          {Array.from({ length: energy.max }).map((_, i) => (
            <span
              key={i}
              className={`lab-energy-pip${i < energy.max - energy.used ? ' lab-energy-pip--on' : ' lab-energy-pip--off'}`}
              aria-hidden
            />
          ))}
        </div>
      </header>

      {/* ── Two-panel workspace ── */}
      <div className="lab-workspace">

        {/* ═══════════════════════════════════
            LEFT PANEL — Creator Form
            ═══════════════════════════════════ */}
        <div className="lab-form-panel">
          <form className="lab-form" onSubmit={handleCreate} noValidate>

            {/* ── Name ── */}
            <div className="form-section">
              <label className="form-label">Creature Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Bramblefox, Tidescale…"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={24}
                autoComplete="off"
              />
            </div>

            {/* ── Type selector ── */}
            <div className="form-section">
              <label className="form-label">Type</label>
              <div className="type-buttons">
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`type-btn ${type === t.id ? 'selected' : ''}`}
                    style={{ '--t-color': t.color }}
                    onClick={() => setType(t.id)}
                  >
                    <span className="type-btn-icon">{t.icon}</span>
                    <span className="type-btn-label">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Creature picker ── */}
            <div className="form-section">
              <label className="form-label">Creature</label>
              <div className="creature-picker">
                {/* Thumbnail — shows tint preview */}
                <div className="creature-thumb-wrap" style={{ isolation: imageColor ? 'isolate' : undefined }}>
                  <img src={image} alt="selected creature" className="creature-thumb" />
                  {imageColor && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      backgroundColor: imageColor,
                      mixBlendMode: 'color',
                      opacity: colorStrength / 100,
                      borderRadius: 'inherit',
                    }} />
                  )}
                </div>

                <div className="creature-picker-actions">
                  <button type="button" className="shuffle-btn" onClick={shuffleCreature}>
                    ⟳ New Creature
                  </button>
                  <button
                    type="button"
                    className="own-image-btn"
                    onClick={() => fileInputRef.current.click()}
                  >
                    Upload my own
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="file-input-hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* ── Colour tint — swatches + strength ── */}
            <div className="form-section">
              <label className="form-label">Colour Tint</label>
              <div className="tint-swatches">
                {TINT_COLORS.map(tc => (
                  <button
                    key={tc.label}
                    type="button"
                    title={tc.label}
                    className={`tint-swatch${imageColor === tc.value ? ' selected' : ''}`}
                    onClick={() => setImageColor(tc.value)}
                  >
                    {tc.swatch
                      ? <span className="tint-swatch-dot" style={{ background: tc.swatch }} />
                      : <span className="tint-swatch-none">✕</span>
                    }
                  </button>
                ))}
              </div>
              {imageColor && (
                <div className="tint-strength-row">
                  <span className="tint-strength-label">Strength</span>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    value={colorStrength}
                    onChange={e => setColorStrength(Number(e.target.value))}
                    className="tint-strength-slider"
                    style={{ '--fill-color': imageColor, '--fill-pct': `${((colorStrength - 10) / 85 * 100).toFixed(1)}%` }}
                  />
                  <span className="tint-strength-value">{colorStrength}%</span>
                </div>
              )}
            </div>

            {/* ── Attacks ── */}
            <div className="form-section">
              <label className="form-label">Attacks</label>
              <div className="points-pool">
                <span className="points-label">Damage remaining</span>
                <span
                  className="points-value"
                  style={{ color: dmgRemaining === 0 ? '#8B2500' : '#C49A3C' }}
                >
                  {dmgRemaining}
                </span>
                <span className="points-total"> / {dmgPool}</span>
              </div>
              <div className="attacks-list">
                {attacks.map((attackEntry, i) => {
                  const dmgSliderMax = Math.min(atk, attackEntry.damage + dmgRemaining);
                  const dmgFillPct   = atk > 5
                    ? ((attackEntry.damage - 5) / (atk - 5) * 100).toFixed(1) + '%'
                    : '100%';
                  return (
                    <div key={i} className="attack-row" style={{ '--t-color': typeColor }}>
                      {/* Name + cooldown hint */}
                      <div className="attack-row-top">
                        <span className="attack-row-num">{i + 1}</span>
                        <input
                          className="form-input attack-name-input"
                          type="text"
                          placeholder={`Attack ${i + 1} name`}
                          value={attackEntry.name}
                          onChange={e => updateAttack(i, 'name', e.target.value)}
                          maxLength={20}
                        />
                        {labStrongIdx === i && (
                          <span
                            className="attack-cooldown-hint"
                            title="Higher damage — will have a 2-turn cooldown in battle"
                          >⏱</span>
                        )}
                      </div>
                      {/* Damage slider */}
                      <div className="attack-dmg-row">
                        <span className="attack-dmg-track-label">DMG</span>
                        <input
                          type="range"
                          min={5}
                          max={dmgSliderMax}
                          value={attackEntry.damage}
                          onChange={e => updateAttack(i, 'damage', Number(e.target.value))}
                          className="attack-dmg-slider"
                          style={{ '--fill-color': typeColor, '--fill-pct': dmgFillPct }}
                        />
                        <span className="attack-dmg-value">{attackEntry.damage}</span>
                      </div>
                      {/* Attack type — locked to creature type */}
                      <div className="attack-type-display" style={{ '--t-color': typeColor }}>
                        <span className="attack-type-display-icon">
                          {TYPES.find(t => t.id === type)?.icon}
                        </span>
                        <span className="attack-type-display-label">
                          {TYPES.find(t => t.id === type)?.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Stat sliders ── */}
            <div className="form-section">
              <label className="form-label">Stats</label>
              <div className="points-pool">
                <span className="points-label">Points remaining</span>
                <span
                  className="points-value"
                  style={{ color: pointsRemaining === 0 ? '#8B2500' : '#C49A3C' }}
                >
                  {pointsRemaining}
                </span>
                <span className="points-total"> / {POOL}</span>
              </div>
              <div className="sliders-list">
                <StatSlider label="HP"  value={hp}  min={50}  max={200} onChange={setHp}  typeColor={typeColor} remaining={pointsRemaining} />
                <StatSlider label="ATK" value={atk} min={10}  max={100} onChange={handleAtkChange} typeColor={typeColor} remaining={pointsRemaining} />
                <StatSlider label="DEF" value={def} min={10}  max={100} onChange={setDef} typeColor={typeColor} remaining={pointsRemaining} />
                <StatSlider label="SPD" value={spd} min={10}  max={100} onChange={setSpd} typeColor={typeColor} remaining={pointsRemaining} />
              </div>
            </div>

            {/* ── Error ── */}
            {error && <p className="form-error" role="alert">{error}</p>}

            {/* ── Submit ── */}
            <div className="form-footer">
              <button type="submit" className="create-btn">
                ✦ Create Creature
              </button>
              {/* success is handled by the full-screen overlay */}
            </div>

          </form>
        </div>

        {/* ═══════════════════════════════════
            RIGHT PANEL — Live Card Preview
            ═══════════════════════════════════ */}
        <div className="lab-preview-panel">
          <p className="preview-eyebrow">✦ Live Preview ✦</p>
          <p className="preview-drag-hint">drag the art window to reframe your creature</p>

          <div className="preview-card-stage">
            <CreatureCard
              creature={previewCreature}
              imagePosition={position}
              imageColor={imageColor}
              imageColorStrength={colorStrength}
              onArtDrag={handleArtDrag}
            />
          </div>

          <button
            type="button"
            className="recentre-btn"
            onClick={() => setPosition({ x: 50, y: 50 })}
          >
            ✛ Re-centre
          </button>
        </div>

      </div>

      {/* ══ LAB RECHARGE OVERLAY ════════════════════════════════════════════ */}
      {showRecharge && (() => {
        const dangerPct   = Math.round(((energy.danger || 0) / MAX_MINIGAME_TRIES) * 100);
        const dangerColor = dangerPct >= 67 ? '#C62828' : dangerPct >= 34 ? '#E65100' : '#F9A825';
        const DangerMeter = dangerPct > 0 ? (
          <div className="lab-danger-bar-wrap">
            <div className="lab-danger-label">
              <span>⚠️ Hazard Level</span>
              <span>{dangerPct}%</span>
            </div>
            <div className="lab-danger-bar">
              <div className="lab-danger-fill" style={{ width: `${dangerPct}%`, background: dangerColor }} />
            </div>
          </div>
        ) : null;

        return (
          <div className={`lab-recharge-overlay${isExploding ? ' lab-recharge-overlay--exploding' : ''}`}>
            <div className={`lab-recharge-panel${isExploding ? ' lab-recharge-panel--shaking' : ''}`}>

              {/* ── CHOOSE phase ── */}
              {rechargePhase === 'choose' && (
                <>
                  <div className="lab-recharge-header">
                    <span className="lab-recharge-icon">⚗️</span>
                    <h2 className="lab-recharge-title">Lab Energy Depleted</h2>
                    <p className="lab-recharge-sub">
                      You've used all {energy.max} creation slots. Recharge to keep going!
                    </p>
                  </div>

                  {DangerMeter}

                  <div className="lab-recharge-options">
                    <div className="lab-recharge-option">
                      <div className="lab-recharge-option-title">🧪 Free Recharge</div>
                      <p className="lab-recharge-option-desc">
                        Calibrate three specimen beakers in the green zone to earn +2 slots.
                        {dangerPct > 0 && <span className="lab-danger-warn"> Careful — failure raises the hazard level!</span>}
                      </p>
                      <button className="lab-recharge-btn lab-recharge-btn--free" onClick={startMinigame}>
                        Start Minigame
                      </button>
                    </div>

                    <div className="lab-recharge-option">
                      <div className="lab-recharge-option-title">🪙 Gold Recharge</div>
                      <p className="lab-recharge-option-desc">
                        Spend <strong>{GOLD_RECHARGE_COST} 🪙</strong> to restore +2 slots instantly.
                      </p>
                      <button
                        className={`lab-recharge-btn lab-recharge-btn--gold${coins < GOLD_RECHARGE_COST ? ' lab-recharge-btn--disabled' : ''}`}
                        onClick={handleGoldRecharge}
                        disabled={coins < GOLD_RECHARGE_COST}
                      >
                        Spend {GOLD_RECHARGE_COST} 🪙
                      </button>
                      {coins < GOLD_RECHARGE_COST && (
                        <span className="lab-recharge-note">Not enough coins ({coins} 🪙)</span>
                      )}
                    </div>
                  </div>

                  <button className="lab-recharge-close" onClick={() => setShowRecharge(false)}>
                    ← Come back later
                  </button>
                </>
              )}

              {/* ── MINIGAME phase ── */}
              {rechargePhase === 'minigame' && (
                <>
                  <div className="lab-recharge-header">
                    <h2 className="lab-recharge-title">Calibrate the Beakers</h2>
                    <p className="lab-recharge-sub">
                      Tap each beaker when the liquid reaches the green zone!
                    </p>
                  </div>

                  {DangerMeter}

                  <div className="lab-beakers">
                    {[0, 1, 2].map(i => {
                      const fill    = beakerRender.fills[i];
                      const locked  = beakerRender.locked[i];
                      const success = beakerRender.success[i];
                      return (
                        <div key={i} className="lab-beaker-wrapper" onClick={() => handleBeakerTap(i)}>
                          <div className={`lab-beaker${locked ? (success ? ' lab-beaker--success' : ' lab-beaker--fail') : ''}`}>
                            <div className="lab-beaker-green-zone" />
                            <div
                              className="lab-beaker-fill"
                              style={{ height: `${fill}%`, background: BEAKER_COLORS[i] }}
                            />
                            {locked && (
                              <div className="lab-beaker-lock">{success ? '✓' : '✗'}</div>
                            )}
                          </div>
                          <span className="lab-beaker-label">
                            {locked ? (success ? '✓ Good!' : '✗ Miss') : ['Slow', 'Med', 'Fast'][i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="lab-minigame-hint">
                    {beakerRender.locked.filter(Boolean).length === 0
                      ? 'Tap each beaker at the right moment!'
                      : `${beakerRender.locked.filter(Boolean).length} / 3 locked`}
                  </p>
                </>
              )}

              {/* ── RESULT phase ── */}
              {rechargePhase === 'result' && (
                <>
                  <div className="lab-recharge-header">
                    <span className="lab-recharge-icon">{minigameAllSuccess ? '🎉' : '😔'}</span>
                    <h2 className="lab-recharge-title">
                      {minigameAllSuccess ? 'Beakers Calibrated!' : 'Not Quite…'}
                    </h2>
                    <p className="lab-recharge-sub">
                      {minigameAllSuccess
                        ? '+2 creation slots restored! Back to work!'
                        : minigameAttempts < MAX_MINIGAME_TRIES
                          ? `Missed! ${MAX_MINIGAME_TRIES - minigameAttempts} attempt${MAX_MINIGAME_TRIES - minigameAttempts === 1 ? '' : 's'} left.`
                          : '💥 The lab is about to blow…'}
                    </p>
                  </div>

                  {!minigameAllSuccess && DangerMeter}

                  {minigameAllSuccess ? (
                    <button className="lab-recharge-btn lab-recharge-btn--free" onClick={() => setShowRecharge(false)}>
                      ✦ Back to the Lab
                    </button>
                  ) : (
                    <>
                      <p className="lab-minigame-attempts">
                        Attempt {minigameAttempts} of {MAX_MINIGAME_TRIES}
                      </p>
                      {minigameAttempts < MAX_MINIGAME_TRIES ? (
                        <div className="lab-recharge-options lab-recharge-options--solo">
                          <div className="lab-recharge-option">
                            <p className="lab-recharge-option-desc">
                              Some beakers missed the mark — give it another go!
                            </p>
                            <button className="lab-recharge-btn lab-recharge-btn--free" onClick={startMinigame}>
                              🧪 Try Again
                            </button>
                          </div>
                          <button className="lab-recharge-close" onClick={() => setRechargePhase('choose')}>
                            Try Gold Recharge Instead
                          </button>
                        </div>
                      ) : (
                        <p className="lab-recharge-sub" style={{ color: '#ff6b3d' }}>
                          Brace yourself…
                        </p>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── EXPLOSION phase ── */}
              {rechargePhase === 'explosion' && (
                <>
                  <div className="lab-explosion-display">
                    <div className="lab-explosion-emoji">💥</div>
                    <h2 className="lab-recharge-title lab-explosion-title">THE LAB EXPLODED!</h2>
                    <p className="lab-recharge-sub">
                      Too many failed calibrations — the beakers overloaded and blew everything up!
                    </p>
                  </div>

                  <div className="lab-danger-bar-wrap">
                    <div className="lab-danger-label">
                      <span>⚠️ Hazard Level</span>
                      <span>100% — DESTROYED</span>
                    </div>
                    <div className="lab-danger-bar">
                      <div className="lab-danger-fill lab-danger-fill--max" style={{ width: '100%', background: '#C62828' }} />
                    </div>
                  </div>

                  <div className="lab-recharge-options lab-recharge-options--solo">
                    <div className="lab-recharge-option">
                      <div className="lab-recharge-option-title">🔧 Repair the Lab</div>
                      <p className="lab-recharge-option-desc">
                        Spend <strong>{EXPLOSION_REPAIR_COST} 🪙</strong> to repair the lab and restore +2 creation slots.
                      </p>
                      <button
                        className={`lab-recharge-btn lab-recharge-btn--repair${coins < EXPLOSION_REPAIR_COST ? ' lab-recharge-btn--disabled' : ''}`}
                        onClick={handleRepairLab}
                        disabled={coins < EXPLOSION_REPAIR_COST}
                      >
                        Pay {EXPLOSION_REPAIR_COST} 🪙 to Repair
                      </button>
                      {coins < EXPLOSION_REPAIR_COST && (
                        <span className="lab-recharge-note">
                          Not enough coins ({coins} 🪙 — need {EXPLOSION_REPAIR_COST - coins} 🪙 more)
                        </span>
                      )}
                    </div>
                  </div>

                  <button className="lab-recharge-close" onClick={() => navigate('/manor')}>
                    ← Come back when you have enough coins
                  </button>
                </>
              )}

            </div>
          </div>
        );
      })()}

      {/* ══ CREATURE CREATED OVERLAY ═════════════════════════════════════════ */}
      {createdCreature && (
        <div className="created-overlay" role="dialog" aria-modal="true">

          {/* Sparkle particles — 12 burst outward in all directions */}
          <div className="created-sparks" aria-hidden>
            {[0,30,60,90,120,150,180,210,240,270,300,330].map(angle => (
              <span
                key={angle}
                className="created-spark"
                style={{ '--spark-angle': `${angle}deg` }}
              >✦</span>
            ))}
          </div>

          <div className="created-panel">
            <h2 className="created-title">
              <span className="created-title-ornament">✦</span>
              Creature Created!
              <span className="created-title-ornament">✦</span>
            </h2>

            <div className="created-card-stage">
              <CreatureCard
                creature={createdCreature}
                imagePosition={createdCreature.imagePosition}
                imageColor={createdCreature.imageColor}
                imageColorStrength={createdCreature.imageColorStrength}
              />
            </div>

            <p className="created-subtitle">
              <em>{createdCreature.name}</em> has been added to your collection!
            </p>

            <div className="created-actions">
              <button
                className="created-btn created-btn--primary"
                onClick={() => { setCreatedCreature(null); resetForm(); }}
              >
                ✦ Create Another
              </button>
              <button
                className="created-btn created-btn--secondary"
                onClick={() => navigate('/menagerie')}
              >
                View Collection →
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
