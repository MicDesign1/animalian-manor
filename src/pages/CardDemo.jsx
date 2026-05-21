import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatureCard from '../components/CreatureCard';
import { getRandomImage } from '../data/creatureImages';
import './CardDemo.css';

// Example creature — Bramblefox, Entry No. 001
const BRAMBLEFOX = {
  name: 'Bramblefox',
  type: 'thorn',
  hp: 90,
  flavor: "A cunning fox draped in living ivy, found lurking in the manor's overgrown east garden.",
  attacks: [
    { name: 'Vine Lash',     damage: 35, type: 'thorn' },
    { name: 'Forest Shroud', damage: 20, type: 'thorn' },
  ],
  atk: 45,
  def: 30,
  spd: 65,
};

export default function CardDemo() {
  const navigate = useNavigate();

  // Image state — randomly assigned on first load
  const [image,    setImage]    = useState(() => getRandomImage());
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [hue,      setHue]      = useState(0);

  // Called by CreatureCard during drag — receives the pixel delta each frame.
  // We convert it into a position percentage and clamp between 0–100.
  // The negative sign means dragging right moves the image right (intuitive grab feel).
  const handleArtDrag = useCallback((dx, dy) => {
    setPosition(prev => ({
      x: Math.max(0, Math.min(100, prev.x - dx * 0.3)),
      y: Math.max(0, Math.min(100, prev.y - dy * 0.3)),
    }));
  }, []);

  function shuffleCreature() {
    setImage(getRandomImage());
    setPosition({ x: 50, y: 50 }); // reset framing for the new creature
  }

  function resetPosition() {
    setPosition({ x: 50, y: 50 });
  }

  function resetHue() {
    setHue(0);
  }

  return (
    <div className="card-demo no-select">

      {/* Title */}
      <div className="card-demo-header">
        <span className="card-demo-ornament">✦</span>
        <h1>Specimen Card</h1>
        <span className="card-demo-ornament">✦</span>
      </div>

      {/* Subtitle */}
      <p className="card-demo-subtitle">
        From Uncle Argon's Menagerie — Entry No. 001
      </p>

      {/* The card itself — drag is enabled by passing onArtDrag + imagePosition + imageHue */}
      <div className="card-demo-stage">
        <CreatureCard
          creature={{ ...BRAMBLEFOX, image }}
          imagePosition={position}
          imageHue={hue}
          onArtDrag={handleArtDrag}
        />
      </div>

      {/* ── Art Controls Panel ── */}
      <div className="art-controls">

        {/* Shuffle + Re-centre buttons */}
        <div className="art-controls-row">
          <button className="art-btn art-btn-primary" onClick={shuffleCreature}>
            ⟳ New Creature
          </button>
          <button className="art-btn art-btn-secondary" onClick={resetPosition}>
            ✛ Re-centre
          </button>
        </div>

        {/* Hue (colour tint) slider */}
        <div className="hue-control">
          <div className="hue-control-header">
            <span className="hue-label">Colour Tint</span>
            <button
              className="hue-reset-btn"
              onClick={resetHue}
              title="Reset tint to original"
            >
              Reset
            </button>
            <span className="hue-value">{hue}°</span>
          </div>
          {/* Rainbow track shows what hue you're picking */}
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={e => setHue(Number(e.target.value))}
            className="hue-slider"
          />
          <div className="hue-labels">
            <span>original</span>
            <span>teal</span>
            <span>purple</span>
            <span>original</span>
          </div>
        </div>

      </div>

      {/* Back button */}
      <button className="card-demo-back-btn" onClick={() => navigate('/manor')}>
        ← Back to Manor
      </button>

    </div>
  );
}
