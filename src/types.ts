export interface Env {
  DB: D1Database
  RATE_LIMIT: KVNamespace
  RATE_LIMITER: DurableObjectNamespace
  ADMIN_SECRET: string
  BASE_URL: string
}