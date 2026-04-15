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
  it('hashes a password deterministically', async () => {
    const a = await hashPassword('duck123')
    const b = await hashPassword('duck123')
    expect(a).toBe(b)
    expect(a).toHaveLength(64) // SHA-256 hex
  })

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('s3cr3t')
    expect(await verifyPassword('s3cr3t', hash)).toBe(true)
  })

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('s3cr3t')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
