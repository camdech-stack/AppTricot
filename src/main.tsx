import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import '@fontsource-variable/dm-sans'
import './index.css'
import App from './App.tsx'
import { ensureSettingsInitialized } from './data'

await ensureSettingsInitialized()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
