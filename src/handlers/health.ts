// 3.4: Lightweight health-check endpoint. Returns 200 with a per-component
// status object so external monitors (Pingdom / UptimeRobot / Cloudflare's
// own health checks) can distinguish a 500 (page down) from a degraded
// service (e.g., D1 in read-only mode). Intentionally unauthenticated.
import type { Context } from 'hono'
import type { Env } from '../types'

interface HealthCheckResult {
  status: 'ok' | 'degraded'
  components: {
    db: 'ok' | 'down'
    rate_limiter: 'ok' | 'down' | 'not_bound'
  }
  version?: string
}

export async function health(c: Context<{ Bindings: Env }>): Promise<Response> {
  const components: HealthCheckResult['components'] = {
    db: 'down',
    rate_limiter: c.env.RATE_LIMITER ? 'ok' : 'not_bound',
  }

  try {
    const probe = await c.env.DB.prepare('SELECT 1 as ok').first<{ ok: number }>()
    components.db = probe?.ok === 1 ? 'ok' : 'down'
  } catch {
    components.db = 'down'
  }

  const result: HealthCheckResult = {
    status: components.db === 'ok' ? 'ok' : 'degraded',
    components,
  }
  return new Response(JSON.stringify(result), {
    status: result.status === 'ok' ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      // Health checks should never be cached.
      'Cache-Control': 'no-store',
    },
  })
}
