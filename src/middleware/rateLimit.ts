import type { Context, Next } from 'hono'
import type { Env } from '../types'

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS = 20

interface RateLimitRecord {
  count: number
  resetAt: number
}

export async function rateLimit(c: Context<{ Bindings: Env }>, next: Next) {
  // Graceful fallback if KV is not bound
  if (!c.env.RATE_LIMIT) {
    console.warn('[rateLimit] RATE_LIMIT KV namespace not bound. Skipping rate limit.')
    return next()
  }

  const ip =
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0].trim() ??
    'unknown'

  const key = `rl:${ip}`
  const now = Date.now()

  const raw = await c.env.RATE_LIMIT.get(key)
  let record: RateLimitRecord = raw
    ? (JSON.parse(raw) as RateLimitRecord)
    : { count: 0, resetAt: now + WINDOW_MS }

  // Reset window if expired
  if (now > record.resetAt) {
    record = { count: 0, resetAt: now + WINDOW_MS }
  }

  const remaining = MAX_REQUESTS - record.count

  c.header('X-RateLimit-Limit', String(MAX_REQUESTS))
  c.header('X-RateLimit-Remaining', String(Math.max(0, remaining - 1)))
  c.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)))

  if (remaining <= 0) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    c.header('Retry-After', String(retryAfter))
    return c.json({ error: 'Rate limit exceeded. Try again later.' }, 429)
  }

  record.count++
  const ttlSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000))
  await c.env.RATE_LIMIT.put(key, JSON.stringify(record), { expirationTtl: ttlSeconds })

  await next()
}
