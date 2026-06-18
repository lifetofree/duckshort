import { Component, type ReactNode } from 'react'
import { Sentry } from '../lib/sentry'

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    // 3.1: forward uncaught render errors to Sentry. No-op when Sentry
    // is disabled (no DSN configured).
    Sentry.withScope((scope) => {
      scope.setExtra('componentStack', errorInfo.componentStack ?? '')
      Sentry.captureException(error)
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0B0E14', color: '#FF0055', fontFamily: 'JetBrains Mono, monospace',
          textAlign: 'center', padding: '2rem',
        }}>
          <div>
            <h1 style={{ fontFamily: 'Orbitron, sans-serif', marginBottom: '1rem', fontSize: '2rem' }}>QUACK!</h1>
            <p style={{ fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Something went wrong
            </p>
            <p style={{ fontSize: '0.65rem', color: '#a0a0b0', marginBottom: '1.5rem' }}>
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem', background: '#00F2FF', border: 'none',
                color: '#000', fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
                cursor: 'pointer', borderRadius: '6px', letterSpacing: '2px',
              }}
            >
              RELOAD
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
