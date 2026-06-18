import type { Context } from 'hono'
import type { Env } from '../types'
import { logger } from './logger'
import { SESSION_MAX_AGE_SECONDS } from './constants'

// 1.5: Tightened from 24h to 1h to limit the blast radius of a stolen cookie.
// The login handler also re-issues the cookie on activity (see `login`),
// effectively turning this into a sliding 1h session for active users.
const SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS

// 1.2: Pick the HMAC key for session tokens. Prefer the dedicated SESSION_SECRET
// so it can be rotated independently of ADMIN_SECRET. Fall back to ADMIN_SECRET
// for local dev and pre-1.2 deployments that haven't provisioned SESSION_SECRET
// yet — that fallback path is also covered by a `session_legacy_key` log line
// so the on-call can spot deployments that still need to provision the secret.
export function sessionSecret(env: { ADMIN_SECRET: string; SESSION_SECRET?: string }): {
  key: string
  legacy: boolean
} {
  if (env.SESSION_SECRET) return { key: env.SESSION_SECRET, legacy: false }
  return { key: env.ADMIN_SECRET, legacy: true }
}

// 1.4: 32-byte random token used as the XSRF-TOKEN cookie value. 64 hex chars;
// that's 256 bits of entropy — enough that an attacker can't guess it. The
// token is generated at login and is independent of the session token.
export function generateCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

// 1.4: read the XSRF-TOKEN cookie value from a Cookie header. Returns null
// when the cookie is absent or empty.
export function readCsrfCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith('XSRF-TOKEN=')) {
      const value = trimmed.slice('XSRF-TOKEN='.length)
      return value || null
    }
  }
  return null
}

// 1.4: constant-time check that the XSRF-TOKEN cookie and X-XSRF-TOKEN header
// carry the same value. Uses the same SHA-256 + timingSafeEqual pattern as
// `timingSafeEqual` above so the comparison itself is not a side channel.
export async function csrfTokensMatch(
  cookieHeader: string | null | undefined,
  headerValue: string | null | undefined,
): Promise<boolean> {
  const cookie = readCsrfCookie(cookieHeader)
  if (!cookie || !headerValue) return false
  if (cookie.length !== headerValue.length) return false
  return timingSafeEqual(cookie, headerValue)
}

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  // Hash both sides first so lengths are always equal, preventing timing leaks via early-return
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ])
  return (crypto.subtle as any).timingSafeEqual(new Uint8Array(aHash), new Uint8Array(bHash))
}

// Generate an HMAC-signed session token: <nonce>.<timestamp>.<hmac>
// The cookie stores this opaque token, not the raw ADMIN_SECRET (S-14).
export async function generateSessionToken(secret: string): Promise<string> {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  const ts = Math.floor(Date.now() / 1000).toString()
  const payload = `${nonce}.${ts}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${payload}.${sigHex}`
}

async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [nonce, tsStr, sigHex] = parts
    const ts = parseInt(tsStr, 10)
    if (!Number.isFinite(ts)) return false
    if (Math.floor(Date.now() / 1000) - ts > SESSION_MAX_AGE) return false
    const payload = `${nonce}.${tsStr}`
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sigBytes = new Uint8Array((sigHex.match(/.{2}/g) ?? []).map(h => parseInt(h, 16)))
    return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
  } catch {
    return false
  }
}

export async function requireAuth(
  env: { ADMIN_SECRET: string; SESSION_SECRET?: string },
  header: string | null | undefined,
  cookieHeader?: string | null
): Promise<Response | null> {
  const unauthorized = new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })

  // 1.3: surface failed-auth attempts with enough context for the on-call to
  // spot brute-force in Cloudflare's observability dashboard. The caller is
  // expected to attach `request` via the helper `requireAuthFromContext` below.
  const logFailure = (reason: string) =>
    logger.warn('auth_failed', { reason })

  if (!env.ADMIN_SECRET) {
    logFailure('admin_secret_unset')
    return unauthorized
  }

  // 1.2: pick the HMAC key for session verification. Falls back to
  // ADMIN_SECRET when SESSION_SECRET is unset; legacy fallback is logged once
  // per request so the on-call sees it in the dashboard.
  const session = sessionSecret(env)
  if (session.legacy) {
    logger.warn('session_legacy_key', { reason: 'SESSION_SECRET unset, using ADMIN_SECRET' })
  }

  // Bearer path: used by CLI / API clients — compares directly to ADMIN_SECRET
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7)
    if (await timingSafeEqual(token, env.ADMIN_SECRET)) return null
    logFailure('bearer_mismatch')
  }

  // Cookie path: uses HMAC-signed session token, not the raw secret (S-14).
  // The HMAC key is SESSION_SECRET (preferred) or ADMIN_SECRET (legacy).
  if (cookieHeader) {
    const token = cookieHeader.split(';').map(s => s.trim())
      .find(s => s.startsWith('admin_token='))?.slice('admin_token='.length)
    if (token) {
      if (await verifySessionToken(token, session.key)) return null
      logFailure(tokenExpired(token, session.key) ? 'session_expired' : 'session_signature_mismatch')
    } else {
      logFailure('cookie_missing')
    }
  }

  if (!header?.startsWith('Bearer ') && !cookieHeader) {
    logFailure('no_credentials')
  }

  return unauthorized
}

// Helper used by the index.tsx auth middleware so 1.3's log line can include
// request metadata (path / ip). Falls back to a plain requireAuth call.
export async function requireAuthFromContext(c: Context<{ Bindings: Env }>): Promise<Response | null> {
  const header = c.req.header('Authorization')
  const cookieHeader = c.req.header('cookie')
  const result = await requireAuth(c.env, header, cookieHeader)
  if (result) {
    logger.warn('auth_failed_context', {
      path: c.req.path,
      method: c.req.method,
      ip: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim(),
    })
  }
  return result
}

// Distinguish a token whose timestamp is older than SESSION_MAX_AGE from one
// whose signature is genuinely invalid. Used to enrich the auth_failed log.
function tokenExpired(token: string, secret: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const ts = parseInt(parts[1], 10)
    if (!Number.isFinite(ts)) return false
    return Math.floor(Date.now() / 1000) - ts > SESSION_MAX_AGE
  } catch {
    return false
  }
}

// S-15: PBKDF2-HMAC-SHA-256 with 16-byte random salt and 100,000 iterations.
// Format on disk: "pbkdf2$100000$<saltHex>$<hashHex>".
// Old unsalted SHA-256 hashes (64 lowercase hex chars) are still verified for
// backward compatibility with rows created before the upgrade, but new writes
// always use PBKDF2.
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_KEY_BITS = 256
const PBKDF2_PREFIX = 'pbkdf2$'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array((hex.match(/.{2}/g) ?? []).length)
  let i = 0
  for (const pair of hex.match(/.{2}/g) ?? []) {
    out[i++] = parseInt(pair, 16)
  }
  return out
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']
  )
  // BufferSource requires ArrayBuffer (not ArrayBufferLike); narrow via slice().
  const saltBuf = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuf, iterations },
    key, PBKDF2_KEY_BITS
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(derived)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Legacy: unsalted SHA-256 (64 hex chars). Verified for backward compat only.
  if (!stored.startsWith(PBKDF2_PREFIX)) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const computedHex = toHex(new Uint8Array(hashBuffer))
    return timingSafeEqual(computedHex, stored.toLowerCase())
  }

  // New: PBKDF2 format.
  const parts = stored.split('$')
  if (parts.length !== 4) return false
  const iterations = parseInt(parts[1], 10)
  if (!Number.isFinite(iterations) || iterations < 1000 || iterations > 10_000_000) return false
  const salt = fromHex(parts[2])
  const expected = fromHex(parts[3])
  if (salt.length === 0 || expected.length === 0) return false
  const derived = await pbkdf2(password, salt, iterations)
  return timingSafeEqual(toHex(derived), toHex(expected))
}
