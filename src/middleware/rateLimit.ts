import type { Context, Next } from 'hono'
import type { Env } from '../types'

const MAX_REQUESTS = 20

export async function rateLimit(c: Context<{ Bindings: Env }>, next: Next) {
  if (!c.env.RATE_LIMITER) {
    console.warn('[rateLimit] RATE_LIMITER DO not bound. Skipping rate limit.')
    return next()
  }

  const ip =
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0].trim() ??
    'unknown'

  const stub = c.env.RATE_LIMITER.get(c.env.RATE_LIMITER.idFromName(ip))
  const res = await stub.fetch(new Request('https://internal/check'))
  const { allowed, resetAt, remaining } = await res.json<{
    allowed: boolean
    resetAt: number
    remaining: number
  }>()

  c.header('X-RateLimit-Limit', String(MAX_REQUESTS))
  c.header('X-RateLimit-Remaining', String(remaining))
  c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    c.header('Retry-After', String(retryAfter))
    return c.json({ error: 'Rate limit exceeded. Try again later.' }, 429)
  }

  await next()
}
