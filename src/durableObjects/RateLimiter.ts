import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../lib/constants'

// P-16: The DO accepts the bucket-specific limit in the request body so a single
// class can serve both pools without code changes. The bucket key is encoded in
// the DO id by the middleware (`api:<ip>` vs `redirect:<ip>`), so counters are
// isolated by construction.
interface RateLimitRequest {
  limit?: number
  bucket?: 'api' | 'redirect'
}

export class RateLimiter implements DurableObject {
  private state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const now = Date.now()
    let allowed = false
    let resetAt = now + RATE_LIMIT_WINDOW_MS
    let remaining = 0

    let limit: number = RATE_LIMIT_MAX_REQUESTS
    try {
      const body = await request.json<RateLimitRequest>()
      if (typeof body.limit === 'number' && body.limit > 0) {
        limit = body.limit
      }
    } catch {
      // No body or unparseable — fall back to the default API limit
    }

    await this.state.storage.transaction(async (txn) => {
      const count = (await txn.get<number>('count')) ?? 0
      const stored = (await txn.get<number>('resetAt')) ?? (now + RATE_LIMIT_WINDOW_MS)

      let currentCount = count
      let currentResetAt = stored

      if (now > currentResetAt) {
        currentCount = 0
        currentResetAt = now + RATE_LIMIT_WINDOW_MS
      }

      resetAt = currentResetAt

      if (currentCount >= limit) {
        allowed = false
        remaining = 0
        return
      }

      currentCount++
      remaining = limit - currentCount
      await txn.put('count', currentCount)
      await txn.put('resetAt', currentResetAt)
      allowed = true
    })

    return Response.json({ allowed, resetAt, remaining })
  }
}
