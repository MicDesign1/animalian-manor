import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileKey } from '../data/profiles';
import { getStoryFlag, setStoryFlag, getJournalPages, setJournalPages } from '../data/gameProgress';
import StoryLetter from '../components/StoryLetter';
import AudioManager from '../audio/AudioManager';
import './Study.css';

// ── Book content library ──────────────────────────────────────────────────────
const BOOKS = {
  elements: {
    id: 'elements',
    spine: 'Elemental Affinities',
    title: 'A Field Guide to Elemental Affinities',
    author: 'Prof. R. Caldwell, Naturalist-in-Residence',
    color: '#5C1208', textColor: '#F5D98A',
    w: 'wide', h: 'tall',
    content: [
      `After years of field observation, I have catalogued six distinct elemental classifications among Animalian specimens. Each type possesses particular strengths and weaknesses in relation to the others — knowledge that proves decisive in the arena.`,
      `EMBER — The fire-blooded. Defeats Thorn. Weakened by Tide.\nTIDE — The water-borne. Defeats Ember. Weakened by Storm.\nTHORN — The earth-rooted. Defeats Tide. Weakened by Ember.\nSTORM — The wind-swift. Defeats Tide. Weakened by Thorn.\nPHANTOM — The otherworldly. Strikes all types harder (×1.25). Resists all incoming force (×0.75).\nIRON — The unyielding. No advantages or disadvantages. Perfectly neutral.`,
      `COMBAT MULTIPLIERS:\nStrong against → 1.5× damage\nWeak against → 0.75× damage\nPhantom attacking → always 1.25×\nPhantom defending → always 0.75×`,
      `These multipliers compound with raw Attack and Defense statistics. A high-Attack Ember specimen striking a low-Defense Thorn specimen can deal tremendous damage. Knowing the chart is necessary — but it is never sufficient.`
    ]
  },

  history: {
    id: 'history',
    spine: 'The Manor Chronicles',
    title: 'The Animalian Manor: A History',
    author: 'Compiled from estate records',
    color: '#1A3A5C', textColor: '#E8D9B8',
    w: 'normal', h: 'tall',
    content: [
      `The Whitmore estate was established in 1847, its grounds stretching across forty acres of ancient woodland on the edge of the great forest. The manor passed through several generations before coming to rest with Uncle Argon — the family's most celebrated naturalist.`,
      `Over four decades, he filled every room with specimens, journals, and curiosities gathered from six continents. He maintained meticulous records of every creature in his care, cataloguing not merely physical attributes but personalities, preferences, and apparent emotional states.`,
      `The Menagerie Garden was his proudest achievement: a living library of Animalian creatures, each named, loved, and understood. He never captured a creature by force. Every specimen came willingly.`,
      `Three months ago, Uncle Argon departed on what his note described only as an "undisclosed expedition," leaving the manor and its creatures in your care. His final written instruction: 'Look after them. And mind the study.'`
    ]
  },

  phantom: {
    id: 'phantom',
    spine: 'The Phantom Codex',
    title: 'The Phantom Codex',
    author: 'Author Unknown',
    color: '#2D0F40', textColor: '#C8A8E0',
    w: 'normal', h: 'tall',
    content: [
      `Twenty years of study have yielded more questions than answers. Phantom-type specimens appear to exist partially beyond our physical world — phased between dimensions that conventional instruments cannot measure.`,
      `This quality makes them resistant to elemental force. Energy that should wound them simply passes through, absorbed by whichever dimension they currently inhabit. Their own strikes, however, land with unusual precision. A Phantom does not merely attack the body. It attacks the essence.`,
      `My Shade Moth specimen has, on three separate occasions, appeared to occupy two rooms simultaneously. I have chosen not to include this in the official report, as I suspect it would not be well received by the Academy.`,
      `FIELD NOTE: Keep study lanterns lit when working with Phantom specimens. They are drawn to darkness in ways that make record-keeping... complicated.`
    ]
  },

  iron: {
    id: 'iron',
    spine: 'Iron & Stone',
    title: 'Iron & Stone: The Constructed Ones',
    author: 'Uncle Argon, 1923',
    color: '#252530', textColor: '#B0B8C8',
    w: 'normal', h: 'short',
    content: [
      `Iron-type specimens are the steadfast pragmatists of the Animalian world. Whether forged of metallic hide, crystalline exoskeleton, or some mineral composition I have yet to classify, they share one defining trait: elemental indifference.`,
      `Fire does not frighten them. Water does not weaken them. They simply endure. This neutrality cuts both ways — an Iron creature holds no particular advantage, but exploits no weakness. In battle, they are the very definition of reliable.`,
      `I theorise that Iron-types evolved in environments where multiple elemental forces competed simultaneously, creating evolutionary pressure toward broad resistance rather than narrow specialisation. A sensible strategy, if perhaps an unexciting one.`
    ]
  },

  cycle: {
    id: 'cycle',
    spine: 'Ember · Thorn · Tide',
    title: 'Ember, Thorn & Tide: The Elemental Cycle',
    author: 'Prof. R. Caldwell, 1911',
    color: '#1A3A1E', textColor: '#A8D8A8',
    w: 'normal', h: 'medium',
    content: [
      `Nature's great cycle repeats itself in miniature through the Animalian elements. Fire consumes plant. Plant drinks water. Water quenches flame. Each preys upon the next. Each falls to another.`,
      `Storm occupies a curious position in this system — devastating against Tide (electricity conducted through water), yet frustrated by Thorn (plant matter absorbs and disperses electrical charge). One might visualise the full system as two overlapping triangles rather than a single circle.`,
      `No single type dominates all others absolutely. Every hunter has a predator. Every strength has its counter. Uncle Argon considered this one of nature's most elegant designs.`,
      `In the wild, these affinities are not merely tactical — they define habitat and temperament. Ember-types thrive in arid waste. Thorn-types in primordial forest. Tide-types at the ocean's edge. Storm-types on exposed clifftops where the wind never sleeps.`
    ]
  },

  storm: {
    id: 'storm',
    spine: 'Storm Phenomena',
    title: 'Storm Phenomena in Animalian Species',
    author: 'Uncle Argon, 1915',
    color: '#5C4800', textColor: '#F0D870',
    w: 'thin', h: 'medium',
    content: [
      `Storm-type specimens are, without exception, among the fastest creatures I have ever studied. Their electrokinetic musculature contracts at rates conventional tissue cannot approach. In battle, this speed grants a decisive first-strike advantage.`,
      `Their affinity with electrical energy creates predictable tactical profiles: devastating against water-bearing Tide types, but frustrated by the dispersive properties of plant matter that Thorn specimens possess.`,
      `FIELD WARNING: Do not conduct Storm-type studies during actual electrical storms. On 14 March 1914, I failed to observe this precaution. My Storm Wren specimen achieved a sustained output I estimate at several thousand volts. Three instruments were destroyed. My hair has not fully recovered.`
    ]
  },

  anatomy: {
    id: 'anatomy',
    spine: 'Creature Anatomy',
    title: 'A Primer on Animalian Anatomy',
    author: 'Dr. M. Haverstock, 1898',
    color: '#4A3010', textColor: '#E8C9A0',
    w: 'thin', h: 'tall',
    content: [
      `All Animalian specimens share several universal biological constants. Vital Force (HP) represents the total resilience of body and spirit. Offensive Capability (ATK) measures raw striking power. Defensive Capacity (DEF) governs ability to absorb or deflect incoming force. Speed (SPD) governs neural response.`,
      `In combat encounters, Speed determines which specimen acts first. A tie is broken by circumstance. Damage is calculated from the attacker's ATK, moderated by the defender's DEF, then scaled by elemental interaction. A minimum of 5 units of damage is always dealt — no strike is entirely without effect.`,
      `Vital Force is not perfectly analogous to physical injury. I have observed specimens continue fighting with seemingly catastrophic wounds, while others were incapacitated by comparatively minor strikes. The measure captures something beyond the merely physical.`
    ]
  },

  vault: {
    id: 'vault',
    spine: '· · ·',
    title: '',
    author: '',
    color: '#0E0E0F', textColor: '#2A2A2A',
    w: 'thin', h: 'short',
    dusty: true,
    content: []
  }
};

// ── Sub-components ────────────────────────────────────────────────────────────
function Book({ book, onClick, secret }) {
  return (
    <div
      className={`book book--${book.h} book--${book.w}${book.dusty ? ' book--dusty' : ''}${secret ? ' book--has-secret' : ''}`}
      style={{ background: book.color }}
      onClick={() => onClick(book)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(book)}
      title={book.dusty ? 'A dusty, forgotten volume…' : book.title}
    >
      <span className="book-spine" style={{ color: book.textColor }}>
        {book.spine}
      </span>
    </div>
  );
}

function Slot({ h = 130 }) {
  return <div className="book-slot" style={{ height: h }} />;
}

// ── Study page ────────────────────────────────────────────────────────────────
export default function Study() {
  const navigate = useNavigate();

  useEffect(() => { AudioManager.playMusic('/sounds/study-screen.mp3'); }, []);

  const [openBook,    setOpenBook]    = useState(null);
  const [vaultPhase,  setVaultPhase]  = useState('idle'); // idle | rumbling | revealed
  const [secretStep,  setSecretStep]  = useState(null);   // null | 0 | 1

  const vaultDiscovered = localStorage.getItem(profileKey('vault-discovered')) === 'true';

  const hasSecret = getStoryFlag('mira-bully-quest-complete')
                 && !getStoryFlag('study-page-hidden')
                 && getJournalPages() === 2;

  function handleBookClick(book) {
    if (book.dusty) {
      if (vaultDiscovered) { navigate('/vault'); return; }
      setVaultPhase('rumbling');
      setTimeout(() => setVaultPhase('revealed'), 1100);
      return;
    }
    if (book.id === 'history' && hasSecret) {
      setSecretStep(0);
      return;
    }
    setOpenBook(book);
  }

  function completeSecret() {
    setStoryFlag('study-page-hidden', true);
    setJournalPages(3);
    setSecretStep(null);
  }

  function enterVault() {
    localStorage.setItem(profileKey('vault-discovered'), 'true');
    navigate('/vault');
  }

  return (
    <div className="study-page">

      {/* Header */}
      <header className="study-header">
        <button className="study-back-btn" onClick={() => navigate('/manor')}>← Manor</button>
        <div className="study-title-group">
          <span className="study-title-icon">📚</span>
          <h1 className="study-title">The Study</h1>
        </div>
        <div className="study-header-filler" aria-hidden />
      </header>

      <main className="study-main">
        <p className="study-hint">Tap any book to read it.</p>

        {/* ── Bookcase ── */}
        <div className={`bookcase${vaultPhase === 'rumbling' ? ' bookcase--rumbling' : ''}`}>

          {/* Shelf 1 */}
          <div className="shelf">
            <Book book={BOOKS.elements}  onClick={handleBookClick} />
            <Slot h={155} />
            <Book book={BOOKS.anatomy}   onClick={handleBookClick} />
            <Book book={BOOKS.storm}     onClick={handleBookClick} />
            <Slot h={120} />
          </div>

          {/* Shelf 2 */}
          <div className="shelf">
            <Book book={BOOKS.history}   onClick={handleBookClick} secret={hasSecret} />
            <Slot h={110} />
            <Book book={BOOKS.phantom}   onClick={handleBookClick} />
            <Slot h={100} />
            <Book book={BOOKS.iron}      onClick={handleBookClick} />
          </div>

          {/* Shelf 3 */}
          <div className="shelf">
            <Slot h={130} />
            <Book book={BOOKS.cycle}     onClick={handleBookClick} />
            <Slot h={150} />
            <Slot h={90}  />
          </div>

          {/* Shelf 4 — the dark bottom shelf */}
          <div className="shelf shelf--dark">
            <Slot h={90} />
            <Slot h={80} />
            <Book book={BOOKS.vault}     onClick={handleBookClick} />
            <Slot h={75} />
            <Slot h={85} />
          </div>

        </div>

        <p className="study-footer-note">
          ✦ Uncle Argon's personal library — handle with care ✦
        </p>
      </main>

      {/* ── Hidden journal page discovery ── */}
      <StoryLetter
        visible={secretStep === 0}
        type="narrative"
        icon="📄"
        title="Something Falls Out"
        paragraphs={[
          "As you pull the book from the shelf, a loose page flutters to the floor.",
          "It is not part of the book. The paper is different — heavier, older. The handwriting is unmistakable.",
          "One of Uncle Argon's journal pages, hidden between the chapters of the manor's history.",
        ]}
        buttonText="Read the Page"
        onClose={() => setSecretStep(1)}
      />
      <StoryLetter
        visible={secretStep === 1}
        type="journal"
        icon="✦"
        title="Argon's Journal — Day 203"
        subtitle="A Trusted Friend"
        paragraphs={[
          "There is a young merchant near the village who trades in creature specimens. She has an eye for quality that rivals my own — and a discretion that surpasses it.",
          "I have entrusted her with something important. Two specimens unlike any I have created before. Dual-natured. She does not fully understand what they are, but she understands what I asked: keep them hidden. Keep them safe.",
          "If the wrong person finds them, everything I have worked for could be undone.",
          "— A.",
        ]}
        buttonText="Add to Journal"
        onClose={completeSecret}
      />

      {/* ── Book reading modal ── */}
      {openBook && (
        <div className="book-modal-overlay" onClick={() => setOpenBook(null)}>
          <div className="open-book" onClick={e => e.stopPropagation()}>

            {/* Left page — title page */}
            <div className="book-page book-page--left">
              <div className="book-ornament">✦</div>
              <h2 className="book-title">{openBook.title}</h2>
              <div className="book-rule" />
              <p className="book-author">{openBook.author}</p>
              <p className="book-library">Animalian Manor Library</p>
            </div>

            {/* Right page — content */}
            <div className="book-page book-page--right">
              {openBook.content.map((para, i) => (
                <p key={i} className="book-para">{para}</p>
              ))}
            </div>

            <button className="book-close-btn" onClick={() => setOpenBook(null)}>
              Close Book
            </button>
          </div>
        </div>
      )}

      {/* ── Vault discovery overlay ── */}
      {(vaultPhase === 'rumbling' || vaultPhase === 'revealed') && (
        <div className={`vault-discover-overlay${vaultPhase === 'revealed' ? ' vault-discover-overlay--visible' : ''}`}>
          {vaultPhase === 'revealed' && (
            <div className="vault-discover-panel">
              <div className="vault-discover-icon">🔓</div>
              <h2 className="vault-discover-title">A Hidden Latch Clicks…</h2>
              <p className="vault-discover-body">
                The bookcase shudders. Behind it, a narrow passage reveals itself —
                Uncle Argon's secret vault, hidden in plain sight all along.
              </p>
              <button className="vault-discover-btn" onClick={enterVault}>
                Enter the Vault →
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
