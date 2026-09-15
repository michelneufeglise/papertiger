import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'
import { applyTheme, readStoredMode } from './lib/theme'
import { hydrateVoice } from './lib/voice'
import { hydrateSources } from './lib/sourcesStore'

applyTheme(readStoredMode())
void hydrateVoice()
void hydrateSources()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
