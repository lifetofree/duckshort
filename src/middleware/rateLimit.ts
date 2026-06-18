import type { Context, Next } from 'hono'
import type { Env } from '../types'
import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_REDIRECT_MAX_REQUESTS,
} from '../lib/constants'
import { logger } from '../lib/logger'

export type RateLimitBucket = 'api' | 'redirect'

// P-16: parameterised bucket so redirects and API writes share an IP key but
// maintain separate counters. A shared IP (carrier/office/CDN egress) can now
// follow 200 redirects/hr without locking the API surface out at 20/hr.
export async function rateLimit(
  c: Context<{ Bindings: Env }>,
  next: Next,
  bucket: RateLimitBucket = 'api'
) {
  if (!c.env.RATE_LIMITER) {
    // P-19: FAIL-OPEN path. A misconfigured deploy (missing RATE_LIMITER
    // binding) lets all requests through. Emit a highly distinguishable
    // structured log line so this surfaces in Cloudflare's observability
    // dashboard and the rateLimit_Disabled alert fires if one is configured.
    // The sentinel message and the fail_open: true flag make it grep-friendly.
    logger.warn('rate_limit_disabled_binding_missing', {
      bucket,
      fail_open: true,
      binding: 'RATE_LIMITER',
      path: c.req.path,
      method: c.req.method,
      action_required: 'add [[durable_objects.bindings]] RATE_LIMITER to wrangler.toml and redeploy',
    })
    return next()
  }

  const ip =
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0].trim() ??
    'unknown'

  const limit = bucket === 'redirect'
    ? RATE_LIMIT_REDIRECT_MAX_REQUESTS
    : RATE_LIMIT_MAX_REQUESTS

  // DO id is namespaced by bucket so each pool has its own counter.
  const stub = c.env.RATE_LIMITER.get(c.env.RATE_LIMITER.idFromName(`${bucket}:${ip}`))
  const res = await stub.fetch(new Request('https://internal/check', {
    method: 'POST',
    body: JSON.stringify({ limit, bucket }),
  }))
  const { allowed, resetAt, remaining } = await res.json<{
    allowed: boolean
    resetAt: number
    remaining: number
  }>()

  c.header('X-RateLimit-Limit', String(limit))
  c.header('X-RateLimit-Remaining', String(remaining))
  c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    c.header('Retry-After', String(retryAfter))
    // 3.2: log every blocked request. Allowed requests are sampled at 1 in 20
    // so a busy worker doesn't drown the dashboard in healthy traffic. Adjust
    // the sample rate by setting RATE_LIMIT_METRIC_SAMPLE env var (0-1).
    logger.warn('rate_limit_check', {
      bucket,
      ip_hash: hashIp(ip),
      allowed: false,
      remaining,
      limit,
      path: c.req.path,
      method: c.req.method,
    })
    return c.json({ error: 'Rate limit exceeded. Try again later.' }, 429)
  }

  // 3.2: sampled metric for allowed traffic. Cheap (1 in 20) so a 200/hr link
  // doesn't emit 200 log lines — the blocked line above is the actionable one.
  const sampleRate = Number(c.env.RATE_LIMIT_METRIC_SAMPLE ?? '0.05')
  if (Number.isFinite(sampleRate) && sampleRate > 0 && Math.random() < sampleRate) {
    logger.info('rate_limit_check', {
      bucket,
      ip_hash: hashIp(ip),
      allowed: true,
      remaining,
      limit,
    })
  }

  await next()
}

// 3.2: hash the IP before logging so Cloudflare logs can be used to alert on
// patterns (one IP saturating) without storing the raw IP (PII).
async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}
