import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Launcher from './pages/Launcher';
import Splash from './pages/Splash';
import Intro from './pages/Intro';
import ProfilePicker from './pages/ProfilePicker';
import PlayerCreate from './pages/PlayerCreate';
import ManorMap from './pages/ManorMap';
import RoomPlaceholder from './pages/RoomPlaceholder';
import CardDemo from './pages/CardDemo';
import CardTest from './pages/CardTest';
import Lab from './pages/Lab';
import Menagerie from './pages/Menagerie';
import Arena from './pages/Arena';
import Study from './pages/Study';
import Vault from './pages/Vault';
import MatchGame from './pages/MatchGame';
import RpsGame from './pages/RpsGame';
import DiceGame from './pages/DiceGame';
import Parlor from './pages/Parlor';
import CroganBattle from './pages/CroganBattle';
import BasementBattle from './pages/BasementBattle';
import BottomBar from './components/BottomBar';
import './styles/globals.css';


export default function App() {
  return (
    <BrowserRouter basename="/game">
      {/* app-shell: fills the visual viewport (100dvh) and holds content + fixed HUD */}
      <div className="app-shell">

        {/* app-content: flex-fills remaining height above the fixed BottomBar */}
        <div className="app-content">
          <Routes>
            {/* ── Pre-game / profile flow ── */}
            <Route path="/"               element={<Launcher />} />
            <Route path="/splash"         element={<Splash />} />
            <Route path="/intro"          element={<Intro />} />
            <Route path="/profile-picker" element={<ProfilePicker />} />
            <Route path="/create-player"  element={<PlayerCreate />} />

            {/* ── In-game screens ── */}
            <Route path="/manor"         element={<ManorMap />} />
            <Route path="/menagerie"     element={<Menagerie />} />
            <Route path="/lab"           element={<Lab />} />
            <Route path="/study"         element={<Study />} />
            <Route path="/vault"         element={<Vault />} />
            <Route path="/parlor"        element={<Parlor />} />
            <Route path="/arena"         element={<Arena />} />
            <Route path="/crogan-battle" element={<CroganBattle />} />
            <Route path="/basement"      element={<BasementBattle />} />
            <Route path="/match"         element={<MatchGame />} />
            <Route path="/rps"           element={<RpsGame />} />
            <Route path="/dice"          element={<DiceGame />} />

            {/* ── Dev / demo pages ── */}
            <Route path="/card-demo" element={<CardDemo />} />
            <Route path="/card-test" element={<CardTest />} />
          </Routes>
        </div>

        {/* Persistent HUD — position:fixed, doesn't affect flex flow */}
        <BottomBar />
      </div>
    </BrowserRouter>
  );
}
