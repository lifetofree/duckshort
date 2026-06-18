import type { Context } from 'hono'
import type { Env } from '../types'
import NotFound from '../ui/pages/NotFound'
import { loadLinkRow, dispatchRedirect } from '../lib/redirectUtils'

export async function redirectLink(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()
  const link = await loadLinkRow(c.env.DB, id)

  if (!link) {
    return c.html(<NotFound message="LINK NOT FOUND" />, 404)
  }

  return dispatchRedirect(c, link)
}
