import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { markIntroSeen } from '../data/profiles';
import './Intro.css';

export default function Intro() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  function handleContinue() {
    markIntroSeen();
    navigate('/manor');
  }

  return (
    <div className="intro-page">
      <div className={`intro-envelope ${visible ? 'intro-envelope--open' : ''}`}>

        <div className="intro-wax-seal">
          <span className="intro-wax-emoji">🦉</span>
        </div>

        <div className="intro-letter">
          <div className="intro-letterhead">
            <span className="intro-firm">H.W. Pemberton &amp; Associates</span>
            <span className="intro-firm-sub">Solicitors at Law — London</span>
          </div>

          <p className="intro-salutation">Dear Esteemed Relative,</p>

          <p className="intro-body">
            It is with great pleasure and some urgency that I write to inform you of your inheritance.
            Your Uncle Argon, the renowned zoologist and creature scholar, has bequeathed to you his
            entire estate — <em>Animalian Manor</em> — along with all its contents,
            curiosities, and inhabitants.
          </p>

          <p className="intro-body">
            He left only one instruction:
          </p>

          <blockquote className="intro-quote">
            "Take care of my creatures, and they shall take care of you."
          </blockquote>

          <p className="intro-body">
            Please present yourself at the Manor at your earliest convenience.
            Enclosed you will find the keys to all rooms save one, which Uncle Argon
            saw fit to conceal himself. We trust you shall discover it in due course.
          </p>

          <div className="intro-closing">
            <p>Yours faithfully,</p>
            <p className="intro-signature">H.W. Pemberton</p>
            <p className="intro-role"><em>Solicitor at Law, London, 1887</em></p>
          </div>

          <div className="intro-divider">✦ &nbsp; ✦ &nbsp; ✦</div>
        </div>

        <button className="intro-continue-btn" onClick={handleContinue}>
          Present Yourself at the Manor →
        </button>

      </div>
    </div>
  );
}
