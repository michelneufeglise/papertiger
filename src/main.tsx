import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/patrick-hand'
import '@fontsource-variable/nunito'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'
import { applyTheme, readStoredMode } from './lib/theme'
import { hydrateVoice } from './lib/voice'
import { hydrateSources } from './lib/sourcesStore'

if ('__TAURI_INTERNALS__' in window) document.documentElement.classList.add('tauri')
applyTheme(readStoredMode())
void hydrateVoice()
void hydrateSources()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
