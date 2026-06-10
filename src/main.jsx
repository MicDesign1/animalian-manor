import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initCreatureImages } from './data/creatureImages.js'
import { migrateLegendaryCreatureArt, migrateLegendaryStats } from './data/gameProgress.js'
import App from './App.jsx'

// Fetch the creature manifest before React renders so getRandomImage()
// is synchronous and ready when Lab's useState initialiser calls it.
// After the pool is loaded, run the one-time migration to fix any existing
// creatures that accidentally received reserved (legendary) art.
initCreatureImages().then(() => {
  migrateLegendaryCreatureArt();
  migrateLegendaryStats();          // boost Genesis/Rekron to v1 stats for existing owners
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
