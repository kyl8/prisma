import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/manrope'
import './styles.css'
import { App } from './App'
import { initTheme } from './theme'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
