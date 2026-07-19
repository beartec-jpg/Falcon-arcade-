import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ParentCommunicationProvider } from './hooks/useParentCommunication'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ParentCommunicationProvider>
        <App />
      </ParentCommunicationProvider>
    </BrowserRouter>
  </StrictMode>,
)
