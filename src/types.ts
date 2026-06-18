export interface Env {
  DB: D1Database
  RATE_LIMITER: DurableObjectNamespace
  ADMIN_SECRET: string
  BASE_URL: string
  // B-13: Pages project URL used by the Worker to proxy the SPA. Defaults to
  // `https://duckshort.pages.dev` so existing deployments keep working without
  // any wrangler.toml change.
  PAGES_URL?: string
}

export interface RedirectLinkRow {
  id: string
  original_url: string
  disabled: number
  expires_at: string | null
  password_hash: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  webhook_url: string | null
  burn_on_read: number
  is_expired: number
}
