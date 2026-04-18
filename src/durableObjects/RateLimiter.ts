const MAX_REQUESTS = 20
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

export class RateLimiter implements DurableObject {
  private state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(_request: Request): Promise<Response> {
    const now = Date.now()
    let allowed = false
    let resetAt = now + WINDOW_MS
    let remaining = 0

    await this.state.storage.transaction(async (txn) => {
      const count = (await txn.get<number>('count')) ?? 0
      const stored = (await txn.get<number>('resetAt')) ?? (now + WINDOW_MS)

      let currentCount = count
      let currentResetAt = stored

      if (now > currentResetAt) {
        currentCount = 0
        currentResetAt = now + WINDOW_MS
      }

      resetAt = currentResetAt

      if (currentCount >= MAX_REQUESTS) {
        allowed = false
        remaining = 0
        return
      }

      currentCount++
      remaining = MAX_REQUESTS - currentCount
      await txn.put('count', currentCount)
      await txn.put('resetAt', currentResetAt)
      allowed = true
    })

    return Response.json({ allowed, resetAt, remaining })
  }
}
