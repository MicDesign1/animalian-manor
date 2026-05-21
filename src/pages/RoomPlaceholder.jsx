import { useNavigate } from 'react-router-dom';
import './RoomPlaceholder.css';

const ROOM_DATA = {
  menagerie: {
    name: 'The Menagerie Garden',
    icon: '🌿',
    description: 'Your creature collection lives here among the overgrown hedgerows and glass terrariums.',
    status: 'Coming soon...',
  },
  lab: {
    name: 'The Lab',
    icon: '⚗️',
    description: "Uncle Argon's creature workshop. Draw, name, and create your own creatures here.",
    status: 'Coming soon...',
  },
  study: {
    name: 'The Study',
    icon: '📖',
    description: "Shelves of journals and secrets. What did Uncle Argon discover?",
    status: 'Coming in V2',
  },
  parlor: {
    name: 'The Parlor',
    icon: '🏪',
    description: 'Villagers visit to buy, sell, and trade creature cards.',
    status: 'Coming in V2',
  },
  arena: {
    name: 'The Arena',
    icon: '⚔️',
    description: 'Battle challengers on the wooden stage. May the strongest creature win!',
    status: 'Coming soon...',
  },
};

export default function RoomPlaceholder({ roomId }) {
  const navigate = useNavigate();
  const room = ROOM_DATA[roomId] || ROOM_DATA.menagerie;

  return (
    <div className="room-placeholder no-select">
      <div className="room-placeholder-card">
        <span className="room-placeholder-icon">{room.icon}</span>
        <h1>{room.name}</h1>
        <p className="room-placeholder-desc">{room.description}</p>
        <div className="room-placeholder-status">{room.status}</div>
        <button className="back-to-manor-btn" onClick={() => navigate('/manor')}>
          ← Back to Manor
        </button>
      </div>
    </div>
  );
}
