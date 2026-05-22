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
      <div className="w-screen h-screen overflow-hidden flex flex-col relative bg-black">
        {/* Game content fills the remaining space */}
        <div className="flex-1 relative overflow-hidden">
          <Routes>
            {/* your existing routes stay exactly the same */}
            <Route path="/"               element={<Launcher />} />
            <Route path="/splash"         element={<Splash />} />
            {/* ... all other routes ... */}
          </Routes>
        </div>

        {/* Persistent HUD — now properly placed */}
        <BottomBar />
      </div>
    </BrowserRouter>
  );
}