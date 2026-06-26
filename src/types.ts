export interface Env {
  DB: D1Database
  RATE_LIMITER: DurableObjectNamespace
  ASSETS: Fetcher
  ADMIN_SECRET: string
  BASE_URL: string
  // 1.2: dedicated HMAC key for session cookies. Rotate independently of
  // ADMIN_SECRET (the Bearer path). Falls back to ADMIN_SECRET when unset
  // (backward compat for local dev and pre-1.2 deployments).
  SESSION_SECRET?: string
  // 3.2: tunable rate-limit metric sample rate (0..1). Default 0.05 (1 in 20
  // allowed requests get logged). Set to 0 to disable allowed-traffic logging,
  // or to 1.0 to log every request. Blocked traffic is always logged.
  RATE_LIMIT_METRIC_SAMPLE?: string
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
