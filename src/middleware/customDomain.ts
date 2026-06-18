import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import { loadLinkRow, dispatchRedirect } from '../lib/redirectUtils'

// S-18: Tighten the localhost short-circuit to exact matches. The previous
// `hostname.includes('localhost')` also matched `evil-localhost.example.com`,
// letting an attacker register such a domain to bypass the custom-domain
// lookup. We now require an exact `localhost` (optionally with port) or a
// 127.x.x.x / ::1 IPv6 loopback prefix.
function isLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (lower === 'localhost') return true
  if (lower.startsWith('localhost:')) return true
  if (lower.startsWith('127.')) return true
  if (lower === '[::1]' || lower.startsWith('[::1]:')) return true
  return false
}

export function resolveCustomDomain(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const hostname = c.req.header('host') || ''
    const baseUrl = c.env.BASE_URL || 'https://duckshort.cc'
    const primaryHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

    if (
      hostname === primaryHost ||
      hostname.endsWith(`.${primaryHost}`) ||
      isLocalHostname(hostname)
    ) {
      return next()
    }

    // Skip custom domain lookup for API routes
    if (c.req.path.startsWith('/api/')) {
      return next()
    }

    // F-03: Use shared loadLinkRow + dispatchRedirect
    const link = await loadLinkRow(c.env.DB, hostname, 'custom_domain')
    if (!link) return next()

    return dispatchRedirect(c, link)
  }
}
