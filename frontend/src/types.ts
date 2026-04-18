export interface StatsData {
  link: {
    id: string
    original_url: string
    created_at: string
    expires_at: string | null
    disabled: number
    tag: string | null
  }
  visits: number
  countries: Array<{ country: string; count: number }>
  referrers: Array<{ referer: string; count: number }>
}
