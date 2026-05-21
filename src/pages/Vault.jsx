import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJournalPages } from '../data/gameProgress';
import AudioManager from '../audio/AudioManager';
import './Vault.css';

const GAMES = [
  {
    id: 'match',
    icon: '🃏',
    label: 'Memory Match',
    desc: 'Flip cards to find all 6 pairs',
    prize: 'Up to 25 🪙',
    route: '/match',
  },
  {
    id: 'rps',
    icon: '✊',
    label: 'Rock · Paper · Scissors',
    desc: 'Beat the challenger — best of 3',
    prize: '15 🪙 for a win',
    route: '/rps',
  },
  {
    id: 'dice',
    icon: '🎲',
    label: "Argon's Lucky Dice",
    desc: 'Roll 3 dice and match the types!',
    prize: 'Up to 25 🪙 per roll',
    route: '/dice',
  },
];

// ── Journal pages ─────────────────────────────────────────────────────────────
const JOURNAL_PAGES = [
  {
    day: 'Day 1,847',
    title: 'The Final Entry',
    text: "I have found it. The creature I spent forty years searching for. It is not what I expected. I cannot bring it back — not yet.\n\nBut I left the coordinates. I left everything you will need.\n\nWhen the time comes, you will know.\n\n— A.",
  },
  {
    day: 'Day 12',
    title: 'A New Beginning',
    text: "The manor is more than I dared hope. Forty acres of woodland, a garden already overgrown with the most extraordinary specimens, and a laboratory that needs only a firm hand and fresh glass.\n\nI unpacked my field journals first. Then the specimen cases. Then the kettle — priorities must be observed.\n\nThis will be the place. I can feel it. Whatever the creatures truly are, whatever they come from — I will find the answer here.\n\n— A.",
  },
  {
    day: 'Day 203',
    title: 'A Trusted Friend',
    text: "There is a young merchant near the village who trades in creature specimens. She has an eye for quality that rivals my own — and a discretion that surpasses it.\n\nI have entrusted her with something important. Two specimens unlike any I have created before. Dual-natured. She does not fully understand what they are, but she understands what I asked: keep them hidden. Keep them safe.\n\nIf the wrong person finds them, everything I have worked for could be undone.\n\n— A.",
  },
  {
    day: 'Day 1,204',
    title: 'A Growing Unease',
    text: "My colleague visited again today. He is brilliant — I have never denied this. His understanding of elemental theory surpasses even Caldwell's.\n\nBut he speaks of the creatures as instruments. As weapons to be refined. He asked about the source again — where they truly come from. I told him I did not know.\n\nThis was not entirely true.\n\nI have begun to lock my study at night.\n\n— A.",
  },
  {
    day: 'Day 1,510',
    title: 'Beneath the Manor',
    text: "I have built it. A chamber beneath the hallway, accessible only through a trapdoor hidden under the great rug. It took three months of work at night when no one could observe.\n\nThe most sensitive materials are stored there now. If anyone finds this room, they know too much already.\n\nI hope it will not be needed. But hope, without preparation, has never been a reliable strategy.\n\n— A.",
  },
  {
    day: 'Day 1,847 — Supplemental',
    title: 'The Coordinates',
    text: "If you are reading this, then you have proven everything I hoped.\n\nThe creatures we know — Ember, Tide, Thorn, Storm, Phantom, Iron — they are not creations. They are echoes. Fragments of something older and more vast than I can describe.\n\nI have found the source. The place where the first Animalian came into being. It is not on any map. The coordinates are encoded in the binding of this journal — you will need the cipher from my study to decode them.\n\nI cannot return from this place. Not yet. Something here prevents it — an artefact, ancient beyond measure, that binds those who enter.\n\nBut I am alive. I am waiting.\n\nBring the cipher. Find the coordinates. Come and find me.\n\n— Your Uncle Argon",
  },
];

// ── Journal reader overlay ────────────────────────────────────────────────────
function JournalReader({ onClose }) {
  const [pageIdx, setPageIdx] = useState(0);
  const totalUnlocked = getJournalPages();
  const page = JOURNAL_PAGES[pageIdx];
  const isLast = pageIdx === totalUnlocked - 1;
  const hasMore = totalUnlocked < JOURNAL_PAGES.length;

  return (
    <div className="journal-overlay" onClick={onClose}>
      <div className="journal-reader" onClick={e => e.stopPropagation()}>

        {/* Page indicator */}
        <div className="journal-reader-meta">
          <span className="journal-reader-day">{page.day}</span>
          <span className="journal-reader-pager">Page {pageIdx + 1} of {totalUnlocked}</span>
        </div>

        <h2 className="journal-reader-title">{page.title}</h2>
        <div className="journal-reader-divider" />
        <p className="journal-reader-text">{page.text}</p>

        {/* Locked next-page teaser */}
        {isLast && hasMore && (
          <p className="journal-reader-locked">
            ✦ The next page is not yet yours to read. More will be revealed as your journey continues. ✦
          </p>
        )}

        {/* Navigation */}
        <div className="journal-reader-nav">
          <button
            className="journal-reader-btn journal-reader-btn--prev"
            onClick={() => setPageIdx(i => i - 1)}
            disabled={pageIdx === 0}
          >
            ← Previous Page
          </button>
          <button
            className="journal-reader-btn journal-reader-btn--next"
            onClick={() => setPageIdx(i => i + 1)}
            disabled={isLast}
          >
            Next Page →
          </button>
        </div>

        <button className="journal-reader-close" onClick={onClose}>
          Close Journal
        </button>
      </div>
    </div>
  );
}

// ── Vault inventory ───────────────────────────────────────────────────────────
const VAULT_ITEMS = [
  {
    id: 'specimens',
    shape: 'chest',
    label: 'Specimen Cases',
    locked: true,
    flavor: `Seven sealed cases arranged on a low shelf, each labelled in Uncle Argon's careful handwriting. The largest bears a cloth tag stitched with a single instruction:\n\n"Do not open until the conditions are right."`,
    hint: '🌟 Rare & legendary creatures — coming soon',
  },
  {
    id: 'gems',
    shape: 'lockbox',
    label: 'The Gem Vault',
    locked: true,
    flavor: `A heavy iron lockbox with three separate keyholes arranged in a row. Through a hairline crack in the lid you can see the faint glint of something that catches even the dim candlelight.`,
    hint: '💎 Gems & rare currency — coming soon',
  },
  {
    id: 'boosters',
    shape: 'cabinet',
    label: 'Card Archives',
    locked: true,
    flavor: `A tall cabinet filled with sealed envelopes stacked in neat rows. Each bears a wax seal and the words BOOSTER PACK — NOT FOR INDIVIDUAL SALE stamped in red ink. There must be hundreds of them.`,
    hint: '🃏 Booster packs of creature cards — coming soon',
  },
  {
    id: 'journal',
    shape: 'journal',
    label: "Argon's Journal",
    locked: false,
    isJournal: true,
    flavor: "Uncle Argon's personal journal. The pages that remain tell a story of discovery, trust, and a secret that changed everything.",
    hint: null,
  },
  {
    id: 'crates',
    shape: 'crates',
    label: 'Expedition Crates',
    locked: true,
    flavor: `Three wooden crates, nailed shut and stamped with customs marks from ports on six continents. One stamp references a place that appears on no atlas in the library — nor any atlas you have ever seen.`,
    hint: '🗺️ Rare items from distant lands — coming soon',
  },
  {
    id: 'mystery',
    shape: 'sphere',
    label: '???',
    locked: true,
    flavor: `A container that does not seem to follow the ordinary rules of containers. You are not entirely certain it is in the same room as you, despite being able to touch it. It hums at a frequency you feel more than hear.`,
    hint: '??? — coming ???',
  },
];

// ── CSS-drawn vault shapes ────────────────────────────────────────────────────
function VaultShape({ shape }) {
  switch (shape) {

    case 'chest':
      return (
        <div className="vshape vshape-chest">
          <div className="vchest-lid">
            <div className="vchest-lid-band" />
            <div className="vchest-clasp" />
          </div>
          <div className="vchest-body">
            <div className="vchest-band" />
            <div className="vchest-lock">
              <div className="vchest-lock-arch" />
            </div>
          </div>
        </div>
      );

    case 'lockbox':
      return (
        <div className="vshape vshape-lockbox">
          <div className="vlockbox-rivet vlockbox-rivet--tl" />
          <div className="vlockbox-rivet vlockbox-rivet--tr" />
          <div className="vlockbox-rivet vlockbox-rivet--bl" />
          <div className="vlockbox-rivet vlockbox-rivet--br" />
          <div className="vlockbox-stripe" />
          <div className="vlockbox-keys">
            <div className="vlockbox-keyhole" />
            <div className="vlockbox-keyhole" />
            <div className="vlockbox-keyhole" />
          </div>
        </div>
      );

    case 'cabinet':
      return (
        <div className="vshape vshape-cabinet">
          <div className="vcabinet-crown" />
          <div className="vcabinet-glass">
            <div className="vcabinet-shelf" />
            <div className="vcabinet-shelf" />
            <div className="vcabinet-glint" />
          </div>
          <div className="vcabinet-base">
            <div className="vcabinet-knob" />
          </div>
        </div>
      );

    case 'journal':
      return (
        <div className="vshape vshape-journal">
          <div className="vjournal-page vjournal-page--left" />
          <div className="vjournal-spine" />
          <div className="vjournal-page vjournal-page--right">
            <div className="vjournal-line" />
            <div className="vjournal-line" />
            <div className="vjournal-line vjournal-line--short" />
          </div>
        </div>
      );

    case 'crates':
      return (
        <div className="vshape vshape-crates">
          <div className="vcrate vcrate--small">
            <div className="vcrate-band" />
          </div>
          <div className="vcrate vcrate--large">
            <div className="vcrate-band" />
            <div className="vcrate-band" />
          </div>
        </div>
      );

    case 'sphere':
      return (
        <div className="vshape vshape-sphere">
          <div className="vsphere-glint" />
        </div>
      );

    default:
      return null;
  }
}

// ── Vault page ────────────────────────────────────────────────────────────────
export default function Vault() {
  const navigate      = useNavigate();

  useEffect(() => { AudioManager.playMusic('/sounds/vault-screen.mp3'); }, []);

  const [active,      setActive]      = useState(null);
  const [showJournal, setShowJournal] = useState(false);

  return (
    <div className="vault-page">
      <div className="vault-candle-glow" aria-hidden />

      {/* Header */}
      <header className="vault-header">
        <button className="vault-back-btn" onClick={() => navigate('/study')}>
          ← The Study
        </button>
        <div className="vault-header-title-group">
          <span className="vault-header-icon">🔐</span>
          <h1 className="vault-header-title">Uncle Argon's Vault</h1>
        </div>
        <div className="vault-header-filler" aria-hidden />
      </header>

      {/* Room */}
      <main className="vault-main">
        <p className="vault-tagline">
          ✦ The most extraordinary discoveries — kept secret from the world ✦
        </p>

        <div className="vault-room">
          {VAULT_ITEMS.map(item => (
            <button
              key={item.id}
              className={`vault-item vault-item--${item.shape}${item.locked ? ' vault-item--locked' : ' vault-item--open'}`}
              onClick={() => item.isJournal ? setShowJournal(true) : setActive(item)}
            >
              <VaultShape shape={item.shape} />
              <span className="vault-item-label">{item.label}</span>
              <span className={`vault-item-status${item.locked ? ' vault-item-status--locked' : ' vault-item-status--open'}`}>
                {item.locked ? '🔒 Locked' : '✦ Open'}
              </span>
            </button>
          ))}
        </div>

        <p className="vault-footer-note">
          Tap any item to inspect it.
        </p>

        {/* ── Games Corner ── */}
        <div className="vault-games">
          <div className="vault-games-heading">
            <span className="vault-games-ornament">✦</span>
            <h2 className="vault-games-title">Games Corner</h2>
            <span className="vault-games-ornament">✦</span>
          </div>
          <p className="vault-games-sub">Play to win coins</p>
          <div className="vault-games-grid">
            {GAMES.map(game => (
              <button
                key={game.id}
                className="vault-game-card"
                onClick={() => navigate(game.route)}
              >
                <span className="vault-game-icon">{game.icon}</span>
                <span className="vault-game-name">{game.label}</span>
                <span className="vault-game-desc">{game.desc}</span>
                <span className="vault-game-prize">{game.prize}</span>
              </button>
            ))}
          </div>
        </div>

      </main>

      {/* Journal reader overlay */}
      {showJournal && <JournalReader onClose={() => setShowJournal(false)} />}

      {/* Info panel — slides up from bottom */}
      {active && (
        <div className="vault-panel-overlay" onClick={() => setActive(null)}>
          <div
            className={`vault-panel${active.locked ? '' : ' vault-panel--open'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="vault-panel-drag-handle" />
            <div className="vault-panel-header">
              <h2 className="vault-panel-title">{active.label}</h2>
              <span className={`vault-panel-badge${active.locked ? ' vault-panel-badge--locked' : ' vault-panel-badge--open'}`}>
                {active.locked ? '🔒 Locked' : '✦ Open'}
              </span>
            </div>
            <p className="vault-panel-flavor">{active.flavor}</p>
            {active.hint && (
              <p className="vault-panel-hint">{active.hint}</p>
            )}
            <button className="vault-panel-close" onClick={() => setActive(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
