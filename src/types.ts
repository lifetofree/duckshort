export interface Env {
  DB: D1Database
  RATE_LIMIT: KVNamespace
  RATE_LIMITER: DurableObjectNamespace
  ADMIN_SECRET: string
  BASE_URL: string
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
