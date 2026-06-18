import type { Env } from '../types'
import { logger } from '../lib/logger'

export async function cleanupExpiredLinks(env: Env): Promise<{ deleted: number }> {
  const result = await env.DB.prepare(
    "DELETE FROM links WHERE expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')"
  ).run()
  const deleted = result.meta.changes ?? 0
  if (deleted > 0) {
    logger.info('cleanup_completed', { deleted })
  }
  return { deleted }
}
