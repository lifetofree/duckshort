/**
 * 3.1: Sentry for frontend errors.
 *
 * Initialises @sentry/react at app boot. The integration is opt-in: if
 * `VITE_SENTRY_DSN` is unset, init() becomes a no-op so local dev and
 * preview environments don't report errors to a third-party.
 *
 * The release is wired to `__APP_VERSION__` (injected by Vite from
 * `package.json`) so deploys can be correlated to error spikes.
 */
import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const RELEASE = __APP_VERSION__
const ENV = import.meta.env.MODE

let initialised = false

export function initSentry(): void {
  if (initialised) return
  initialised = true
  if (!DSN) {
    // No DSN configured — silently skip. Production deployments can set
    // VITE_SENTRY_DSN via Cloudflare Pages env vars to enable capture.
    return
  }
  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    environment: ENV,
    // SPA: the URL changes client-side, so enable automatic breadcrumbs.
    integrations: [Sentry.browserTracingIntegration()],
    // Sample 20% of transactions in production. Errors are always captured.
    tracesSampleRate: ENV === 'production' ? 0.2 : 1.0,
    // Don't PII-strip; we only collect error stack traces.
    sendDefaultPii: false,
  })
}

export { Sentry }
