// 4.2: every export has an explicit type annotation so downstream consumers
// see the literal type (e.g. `60 * 60 * 1000` becomes `3_600_000`, not
// `number`). `as const` cannot be applied to arithmetic expressions directly,
// so we annotate the type instead — same outcome at the call site.

export const RATE_LIMIT_MAX_REQUESTS = 20 as const
const RATE_LIMIT_WINDOW_MS_RAW = 60 * 60 * 1000 // 1 hour
export const RATE_LIMIT_WINDOW_MS: typeof RATE_LIMIT_WINDOW_MS_RAW = RATE_LIMIT_WINDOW_MS_RAW

// P-16: separate rate-limit bucket for short-link redirects. Shared IPs (office,
// carrier, CDN egress) hit 20+ redirects/hr, so the cap is much higher than for
// auth/api writes. The bucket is keyed by "redirect" vs "api" so the two pools
// do not share a counter.
export const RATE_LIMIT_REDIRECT_MAX_REQUESTS = 200 as const

// S-15 / S-16 / B-10 / B-11 / 4.2: validation bounds for user-supplied fields.
export const EXTEND_HOURS_MIN = 1 as const
export const EXTEND_HOURS_MAX = 8_760 as const // 1 year
export const BULK_DELETE_MAX_IDS = 100 as const
export const EXPORT_MAX_ROWS = 10_000 as const

// Field-length caps to keep DB rows bounded (B-11).
export const MAX_TAG_LENGTH = 64 as const
export const MAX_UTM_LENGTH = 200 as const
export const MAX_OG_TITLE_LENGTH = 200 as const
export const MAX_OG_DESCRIPTION_LENGTH = 500 as const

// 4.2: New caps mirrored to the frontend so client-side validation can use the
// same constants. URL is bounded at 8 KB (browser limit). Password is bounded
// at 256 chars — PBKDF2 with 100k iterations is still instant at this length.
const MAX_URL_LENGTH_RAW = 8 * 1024
export const MAX_URL_LENGTH: typeof MAX_URL_LENGTH_RAW = MAX_URL_LENGTH_RAW
export const MAX_PASSWORD_LENGTH = 256 as const

// P-18: webhook POST timeout (ms). Slow webhooks should not hold Worker CPU
// for the full 30s waitUntil budget.
export const WEBHOOK_TIMEOUT_MS = 5_000 as const

// Custom-ID regex / max length — shared between Admin and ShortenForm.
export const CUSTOM_ID_REGEX: RegExp = /^[a-zA-Z0-9_-]{3,20}$/
export const CUSTOM_ID_MAX_LENGTH = 20 as const

// 1.5: session lifetime in seconds. 1h fixed; the `login` handler refreshes
// the cookie on each successful auth so an active admin keeps an effective
// sliding session.
const SESSION_MAX_AGE_SECONDS_RAW = 60 * 60
export const SESSION_MAX_AGE_SECONDS: typeof SESSION_MAX_AGE_SECONDS_RAW = SESSION_MAX_AGE_SECONDS_RAW
