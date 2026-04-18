export function injectUtm(
  url: string,
  source: string | null,
  medium: string | null,
  campaign: string | null
): string {
  if (!source && !medium && !campaign) return url
  try {
    const u = new URL(url)
    if (source) u.searchParams.set('utm_source', source)
    if (medium) u.searchParams.set('utm_medium', medium)
    if (campaign) u.searchParams.set('utm_campaign', campaign)
    return u.toString()
  } catch {
    return url
  }
}
