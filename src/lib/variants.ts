export interface VariantRow {
  destination_url: string
  weight: number
}

export function pickVariant(variants: VariantRow[]): string {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
  let random = Math.random() * totalWeight
  for (const v of variants) {
    random -= v.weight
    if (random <= 0) return v.destination_url
  }
  return variants[variants.length - 1].destination_url
}
