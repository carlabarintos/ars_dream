import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LucideProvider } from 'lucide-react'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initIosZoomReset } from './lib/ios-zoom-reset.ts'
import { initSentry } from './lib/sentry.ts'

initIosZoomReset()
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Slightly bolder default stroke than lucide's 2 — reads sportier at nav/button sizes. */}
      <LucideProvider strokeWidth={2.25}>
        <App />
      </LucideProvider>
    </ErrorBoundary>
  </StrictMode>,
)
