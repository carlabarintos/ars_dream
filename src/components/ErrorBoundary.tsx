import { Component, type ErrorInfo, type ReactNode } from 'react'

import { LogoBadge } from '@/components/LogoBadge'
import { RouteLines } from '@/components/RouteLines'
import { Button } from '@/components/ui/button'
import { captureException } from '@/lib/sentry'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Never surfaced in the UI — the fallback below stays deliberately
    // non-technical (no error.message, no stack) for the registrant.
    console.error('Unhandled error in ARS Dream', error, errorInfo)
    captureException(error, { componentStack: errorInfo.componentStack })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-primary via-brand-navy to-[#041d3d] px-6 text-center">
        <RouteLines className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />
        <LogoBadge className="relative" />
        <div className="relative flex max-w-sm flex-col items-center gap-2">
          <h1 className="font-display text-3xl tracking-wide text-white">Wrong turn on the course</h1>
          <p className="text-sm text-white/80">
            Something tripped us up on this page, but your bookings and account are safe. Let's get you
            back on track.
          </p>
        </div>
        <Button
          variant="secondary"
          className="relative"
          onClick={() => window.location.reload()}
        >
          Reload
        </Button>
      </div>
    )
  }
}
