import { describe, it, expect } from 'vitest'
import { generateId } from '../../src/lib/nanoid'

describe('generateId', () => {
  it('returns an 8-character string', () => {
    expect(generateId()).toHaveLength(8)
  })

  it('returns only Base62 characters', () => {
    const id = generateId()
    expect(id).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})
