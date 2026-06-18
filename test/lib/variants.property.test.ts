// 5.2: Property-based tests for pickVariant. We use fast-check to assert
// invariants across a large generated input space instead of hand-picked
// examples. Distribution test runs 20 000 trials per property invocation
// and asserts each weight is hit within ±5% of its expected share.
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { pickVariant, type VariantRow } from '../../src/lib/variants'

// Generate 1–6 variants with unique URLs and weights 1..10.
const variantsArb = fc.uniqueArray(
  fc.record({
    destination_url: fc.webUrl(),
    weight: fc.integer({ min: 1, max: 10 }),
  }),
  { minLength: 1, maxLength: 6, selector: (v) => v.destination_url }
)

describe('pickVariant — properties', () => {
  it('always returns a URL from the input set', () => {
    fc.assert(
      fc.property(variantsArb, (variants) => {
        const urls = new Set(variants.map((v) => v.destination_url))
        // 200 samples per property run — enough to catch off-by-one bugs
        // without making the test slow.
        for (let i = 0; i < 200; i++) {
          expect(urls.has(pickVariant(variants))).toBe(true)
        }
      }),
      { numRuns: 50 }
    )
  })

  it('single variant is always picked', () => {
    const singleArb = fc.record({
      destination_url: fc.webUrl(),
      weight: fc.integer({ min: 1, max: 100 }),
    })
    fc.assert(
      fc.property(singleArb, (variant) => {
        for (let i = 0; i < 50; i++) {
          expect(pickVariant([variant])).toBe(variant.destination_url)
        }
      }),
      { numRuns: 50 }
    )
  })

  it('distribution is within ±5% of expected share over 5 000 trials', () => {
    fc.assert(
      fc.property(
        // Two-variant scenario is the easiest to assert distribution for.
        fc.record({
          urlA: fc.webUrl(),
          urlB: fc.webUrl(),
          weightA: fc.integer({ min: 1, max: 10 }),
          weightB: fc.integer({ min: 1, max: 10 }),
        }),
        ({ urlA, urlB, weightA, weightB }) => {
          // Ensure urls are distinct.
          fc.pre(urlA !== urlB)
          const variants: VariantRow[] = [
            { destination_url: urlA, weight: weightA },
            { destination_url: urlB, weight: weightB },
          ]
          const total = weightA + weightB
          const expectedShareA = weightA / total
          const trials = 5_000
          let countA = 0
          for (let i = 0; i < trials; i++) {
            if (pickVariant(variants) === urlA) countA++
          }
          const actualShareA = countA / trials
          // ±5% absolute tolerance (e.g. weightA=1, weightB=9 → expected 0.10,
          // accept 0.05..0.15).
          expect(Math.abs(actualShareA - expectedShareA)).toBeLessThan(0.05)
        }
      ),
      { numRuns: 10 } // 10 scenarios × 5 000 trials = 50 000 picks per run
    )
  })

  it('preserves total weight (no weight is silently dropped)', () => {
    fc.assert(
      fc.property(variantsArb, (variants) => {
        const totalWeight = variants.reduce((s, v) => s + v.weight, 0)
        let random = Math.random() * totalWeight
        // The pre-loop partial sums must equal the total weight.
        let acc = 0
        for (const v of variants) {
          acc += v.weight
        }
        expect(acc).toBe(totalWeight)
        // And `random` starts within the [0, total) range.
        expect(random).toBeGreaterThanOrEqual(0)
        expect(random).toBeLessThanOrEqual(totalWeight)
      }),
      { numRuns: 50 }
    )
  })

  it('empty input returns empty string (defensive — caller should pre-check)', () => {
    expect(pickVariant([])).toBe('')
  })

  it('all-zero weights fall back to the first variant (round-robin)', () => {
    const variants: VariantRow[] = [
      { destination_url: 'https://a.example', weight: 0 },
      { destination_url: 'https://b.example', weight: 0 },
    ]
    expect(pickVariant(variants)).toBe('https://a.example')
  })
})
