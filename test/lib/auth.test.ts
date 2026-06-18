import { describe, it, expect } from 'vitest'
import { timingSafeEqual, requireAuth, hashPassword, verifyPassword } from '../../src/lib/auth'

describe('timingSafeEqual', () => {
  it('returns true for equal strings', async () => {
    expect(await timingSafeEqual('hello', 'hello')).toBe(true)
  })

  it('returns false for different strings', async () => {
    expect(await timingSafeEqual('hello', 'world')).toBe(false)
  })

  it('returns false for different lengths', async () => {
    expect(await timingSafeEqual('abc', 'abcd')).toBe(false)
  })

  it('returns false for empty vs non-empty', async () => {
    expect(await timingSafeEqual('', 'x')).toBe(false)
  })

  it('returns true for empty strings', async () => {
    expect(await timingSafeEqual('', '')).toBe(true)
  })
})

describe('requireAuth', () => {
  const env = { ADMIN_SECRET: 'test-secret' }

  it('returns null when Bearer token matches', async () => {
    const result = await requireAuth(env, 'Bearer test-secret')
    expect(result).toBeNull()
  })

  it('returns 401 when token is wrong', async () => {
    const result = await requireAuth(env, 'Bearer wrong-secret')
    expect(result).not.toBeNull()
    expect((result as Response).status).toBe(401)
  })

  it('returns 401 when header is missing', async () => {
    const result = await requireAuth(env, null)
    expect(result).not.toBeNull()
    expect((result as Response).status).toBe(401)
  })

  it('returns 401 when header lacks Bearer prefix', async () => {
    const result = await requireAuth(env, 'test-secret')
    expect(result).not.toBeNull()
    expect((result as Response).status).toBe(401)
  })
})

describe('hashPassword / verifyPassword', () => {
  it('hashes a password with a random salt (non-deterministic)', async () => {
    // S-15: PBKDF2 + random salt — two hashes of the same password must differ.
    const a = await hashPassword('duck123')
    const b = await hashPassword('duck123')
    expect(a).not.toBe(b)
    expect(a.startsWith('pbkdf2$100000$')).toBe(true)
  })

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('s3cr3t')
    expect(await verifyPassword('s3cr3t', hash)).toBe(true)
  })

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('s3cr3t')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('verifyPassword still accepts legacy unsalted SHA-256 hashes (backward compat)', async () => {
    // Pre-migration hashes are 64 lowercase hex chars (raw SHA-256).
    const legacyHash = '5e8ff9bf55ba3508199f5b5b1d1c0a3e9b3a4e5d3c0c7e3a8a0c7e3a8a0c7e3a'
    // First confirm we can compute SHA-256 of 'hunter2' for the test.
    const encoder = new TextEncoder()
    const sha = await crypto.subtle.digest('SHA-256', encoder.encode('hunter2'))
    const shaHex = Array.from(new Uint8Array(sha)).map((b) => b.toString(16).padStart(2, '0')).join('')
    expect(await verifyPassword('hunter2', shaHex)).toBe(true)
    expect(await verifyPassword('wrong', shaHex)).toBe(false)
    expect(legacyHash).toHaveLength(64) // sanity
  })

  it('verifyPassword rejects malformed PBKDF2 strings', async () => {
    expect(await verifyPassword('s3cr3t', 'pbkdf2$notanint$salt$hash')).toBe(false)
    expect(await verifyPassword('s3cr3t', 'pbkdf2$100000$$$')).toBe(false)
  })
})
