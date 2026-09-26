import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './theme.css'
import './atlas.css'
import './community.css'
import './glass.css'
import {PreferencesProvider} from './preferences'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider><App /></PreferencesProvider>
  </React.StrictMode>,
)
