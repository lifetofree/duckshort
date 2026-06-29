/** @jsxImportSource hono/jsx */
import type { Context } from 'hono'
import type { Env, RedirectLinkRow } from '../types'
import { verifyPassword } from '../lib/auth'
import PasswordEntry from '../ui/pages/PasswordEntry'
import NotFound from '../ui/pages/NotFound'
import { loadLinkRow, resolveDestination, recordAnalytics, handleBurnOnRead, refererHostname, normalizeLinkId } from '../lib/redirectUtils'

export async function showPasswordEntry(c: Context<{ Bindings: Env }>) {
  const id = normalizeLinkId(c.req.param('id') ?? '')
  const link = await loadLinkRow(c.env.DB, id)

  if (!link || link.disabled || !link.password_hash) {
    return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
  }

  if (link.is_expired) {
    return c.html(<NotFound message="LINK EXPIRED" />, 410)
  }

  // Render the form with the stored id (preserves original casing in the URL).
  return c.html(<PasswordEntry id={link.id} error={null} />)
}

export async function verifyPasswordEntry(c: Context<{ Bindings: Env }>) {
  const id = normalizeLinkId(c.req.param('id') ?? '')
  const link = await loadLinkRow(c.env.DB, id)

  if (!link || link.disabled || !link.password_hash) {
    return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
  }

  if (link.is_expired) {
    return c.html(<NotFound message="LINK EXPIRED" />, 410)
  }

  const body = await c.req.parseBody()
  const password = String(body.password ?? '')

  const valid = await verifyPassword(password, link.password_hash)
  if (!valid) {
    return c.html(<PasswordEntry id={link.id} error="Incorrect password" />, 401)
  }

  // S-21: use the STORED id (link.id) for burn / analytics / destination
  // resolution so the rows join correctly even when the request arrived in a
  // different case (e.g. a scanner that lower-cased the URL).
  // Password verified — now handle burn-on-read + destination resolution + analytics
  if (link.burn_on_read) {
    const burned = await handleBurnOnRead(c.env.DB, link.id)
    if (!burned) return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
  }

  const country = (c.req.header('cf-ipcountry') || 'unknown').toUpperCase()
  // S-20: store only the referer hostname (matches redirectUtils dispatchRedirect).
  const referer = refererHostname(c.req.header('referer') ?? '').slice(0, 255)
  const ua = (c.req.header('user-agent') || 'unknown').slice(0, 255)

  const destination = await resolveDestination(
    c.env.DB, link.id, link.original_url,
    link.utm_source, link.utm_medium, link.utm_campaign,
    country
  )

  recordAnalytics(c.executionCtx, c.env.DB, link.id, country, referer, ua, link.webhook_url)

  return c.redirect(destination, 302)
}
