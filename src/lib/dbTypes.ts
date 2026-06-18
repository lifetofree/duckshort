// 4.3: Shared row interfaces for D1 query results. Each interface matches the
// column order / types of the corresponding SELECT in the handler. Using a
// single source of truth eliminates the ad-hoc `{ id, original_url, ... }`
// shapes that previously lived inline in each handler.

export interface LinkRow {
  id: string
  original_url: string
  created_at: string
  expires_at: string | null
  disabled: number
  password_hash: string | null
  tag: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  webhook_url: string | null
  burn_on_read: number
  og_title: string | null
  og_description: string | null
  og_image: string | null
  custom_domain: string | null
  visits: number
}

/** LinkRow + per-day visit counts for the last 7 days (P-02 / P-12). */
export interface LinkRowWithSparkline extends LinkRow {
  sparkline: number[]
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

export interface AnalyticsRow {
  id: string | null
  link_id: string
  country: string | null
  referer: string | null
  user_agent: string | null
  timestamp: string | null
}

export interface VariantRow {
  id: string
  link_id: string
  destination_url: string
  weight: number
}

export interface GeoRedirectRow {
  id: string
  link_id: string
  country_code: string
  destination_url: string
}

export interface CounterRow {
  key: string
  value: number
}
