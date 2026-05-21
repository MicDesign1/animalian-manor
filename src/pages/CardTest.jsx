import { useNavigate } from 'react-router-dom';
import CreatureCard from '../components/CreatureCard';
import './CardTest.css';

// One example creature for each of the 6 types
const ALL_CREATURES = [
  {
    name: 'Flameclaw',
    type: 'ember',
    hp: 120,
    attacks: [
      { name: 'Fire Slash',  damage: 30, type: 'ember' },
      { name: 'Ember Burst', damage: 45, type: 'ember' },
    ],
    atk: 65, def: 40, spd: 70,
  },
  {
    name: 'Tidescale',
    type: 'tide',
    hp: 150,
    attacks: [
      { name: 'Wave Crash', damage: 35, type: 'tide' },
      { name: 'Riptide',    damage: 40, type: 'tide' },
    ],
    atk: 50, def: 75, spd: 45,
  },
  {
    name: 'Thornmaw',
    type: 'thorn',
    hp: 130,
    attacks: [
      { name: 'Vine Lash',   damage: 25, type: 'thorn' },
      { name: 'Root Crush',  damage: 50, type: 'thorn' },
    ],
    atk: 60, def: 55, spd: 50,
  },
  {
    name: 'Voltspark',
    type: 'storm',
    hp: 100,
    attacks: [
      { name: 'Lightning Jab',   damage: 20, type: 'storm' },
      { name: 'Thunder Strike',  damage: 55, type: 'storm' },
    ],
    atk: 80, def: 30, spd: 90,
  },
  {
    name: 'Noxwisp',
    type: 'phantom',
    hp: 110,
    attacks: [
      { name: 'Shadow Fang', damage: 30, type: 'phantom' },
      { name: 'Void Pulse',  damage: 45, type: 'phantom' },
    ],
    atk: 70, def: 35, spd: 85,
  },
  {
    name: 'Ironclad',
    type: 'iron',
    hp: 180,
    attacks: [
      { name: 'Steel Slam', damage: 35, type: 'iron' },
      { name: 'Forge Bash', damage: 40, type: 'iron' },
    ],
    atk: 45, def: 90, spd: 25,
  },
];

export default function CardTest() {
  const navigate = useNavigate();

  return (
    <div className="card-test">

      {/* Page header */}
      <div className="card-test-header">
        <span className="card-test-ornament">✦</span>
        <h1>All Six Types</h1>
        <span className="card-test-ornament">✦</span>
      </div>
      <p className="card-test-subtitle">
        Uncle Argon's specimen catalogue — one of each ink
      </p>

      {/* 3 × 2 card grid */}
      <div className="card-test-grid">
        {ALL_CREATURES.map((creature) => (
          <CreatureCard key={creature.name} creature={creature} />
        ))}
      </div>

      <button className="card-test-back" onClick={() => navigate('/manor')}>
        ← Back to Manor
      </button>

    </div>
  );
}
