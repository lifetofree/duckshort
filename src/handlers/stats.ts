import type { Context } from 'hono'
import type { Env } from '../types'

export async function getStats(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()

  const [link, visits, countries, referrers] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(id).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM analytics WHERE link_id = ?').bind(id).first(),
    c.env.DB.prepare(
      'SELECT country, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY country ORDER BY count DESC LIMIT 10'
    ).bind(id).all(),
    c.env.DB.prepare(
      'SELECT referer, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY referer ORDER BY count DESC LIMIT 10'
    ).bind(id).all()
  ])

  if (!link) return c.json({ error: 'Not found' }, 404)

  return c.json({ link, visits: visits?.count || 0, countries: countries.results, referrers: referrers.results })
}