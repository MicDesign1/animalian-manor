import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfiles, getActiveProfileName, migrateExistingData, isIntroSeen } from '../data/profiles';

// Entry point — runs migration then redirects to the right screen.
// The user should never see this component for more than a flash.
export default function Launcher() {
  const navigate = useNavigate();

  useEffect(() => {
    migrateExistingData();
    const profiles = getProfiles();
    const active   = getActiveProfileName();

    let next;
    if (profiles.length === 0) next = '/create-player';
    else if (!active || !profiles.find(p => p.name === active)) next = '/profile-picker';
    else next = isIntroSeen() ? '/manor' : '/intro';

    sessionStorage.setItem('splash-next', next);
    navigate('/splash', { replace: true });
  }, [navigate]);

  // Warm parchment flash while we decide where to go
  return <div style={{ background: '#F5F0E1', height: '100vh', width: '100vw' }} />;
}
