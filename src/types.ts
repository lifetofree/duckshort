export interface Env {
  DB: D1Database
  RATE_LIMIT: KVNamespace
  ADMIN_SECRET: string
  BASE_URL: string
}