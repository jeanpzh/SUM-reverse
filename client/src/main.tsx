import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installLocalModeConsole } from './data/localDevMode.ts'

installLocalModeConsole(import.meta.env.VITE_SUM_DATA_MODE === 'local' && import.meta.env.VITE_SUM_DEVTOOLS === '1')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
