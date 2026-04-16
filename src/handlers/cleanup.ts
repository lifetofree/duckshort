import type { Env } from '../types'

export async function cleanupExpiredLinks(env: Env): Promise<{ deleted: number }> {
  const result = await env.DB.prepare(
    "DELETE FROM links WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
  ).run()
  return { deleted: result.meta.changes ?? 0 }
}
