import type { Context } from 'hono'
import type { Env } from '../types'
import { timingSafeEqual, generateSessionToken, sessionSecret, generateCsrfToken } from '../lib/auth'
import { SESSION_MAX_AGE_SECONDS } from '../lib/constants'

const COOKIE_NAME = 'admin_token'
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
// 1.5: 1-hour fixed lifetime (was 24h). The session token is HMAC-signed and
// the login handler also exposes a re-issue endpoint (currently just on login)
// to keep active admin sessions alive without exceeding the 1h Max-Age.
const MAX_AGE = SESSION_MAX_AGE_SECONDS

export async function login(c: Context<{ Bindings: Env }>) {
  const { password } = await c.req.json<{ password?: string }>()
  if (!password) return c.json({ error: 'Password required' }, 400)

  if (!c.env.ADMIN_SECRET) return c.json({ error: 'Server misconfigured' }, 500)

  const valid = await timingSafeEqual(password, c.env.ADMIN_SECRET)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  // 1.2: sign the session cookie with the dedicated SESSION_SECRET (falls
  // back to ADMIN_SECRET if SESSION_SECRET is unset; the same fallback is
  // applied on the verify path inside requireAuth).
  const session = sessionSecret(c.env)
  const sessionToken = await generateSessionToken(session.key)
  // 1.4: double-submit CSRF token. Non-HttpOnly so the SPA can read it and
  // echo it back as the X-XSRF-TOKEN header on state-changing requests. The
  // server only verifies that the cookie and header match — no DB lookup.
  const csrfToken = generateCsrfToken()
  const res = c.json({ success: true })
  res.headers.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`
  )
  res.headers.append(
    'Set-Cookie',
    `${CSRF_COOKIE_NAME}=${csrfToken}; Path=/; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`
  )
  return res
}

export async function logout(c: Context<{ Bindings: Env }>) {
  const res = c.json({ success: true })
  res.headers.set(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  )
  return res
}

export async function checkAuth(c: Context<{ Bindings: Env }>) {
  // requireAuth already ran via middleware — if we got here, we're authenticated
  return c.json({ authenticated: true })
}
