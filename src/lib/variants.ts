export interface VariantRow {
  destination_url: string
  weight: number
}

/**
 * Pick one of the weighted variants at random. `weight` MUST be a positive
 * integer. Callers should pre-filter to variants with `weight > 0` and reject
 * an empty input — the function returns an empty string for the empty case
 * as a defensive fallback (resolveDestination only calls this when length > 0).
 */
export function pickVariant(variants: VariantRow[]): string {
  if (variants.length === 0) return ''
  const totalWeight = variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0)
  if (totalWeight <= 0) {
    // All weights are zero or negative — fall back to round-robin.
    return variants[0].destination_url
  }
  let random = Math.random() * totalWeight
  for (const v of variants) {
    random -= Math.max(0, v.weight)
    if (random <= 0) return v.destination_url
  }
  return variants[variants.length - 1].destination_url
}
