export interface Link {
  id: string
  original_url: string
  created_at: string
  expires_at: string | null
  disabled: number
  tag: string | null
  sparkline: number[]
  visits?: number
}

export interface Variant {
  id: string
  destination_url: string
  weight: number
}

export interface GeoRedirect {
  id: string
  country_code: string
  destination_url: string
}

export type AdminTab = 'links' | 'create' | 'stats' | 'link-stats'

export interface CreateLinkFormData {
  url: string
  customId: string
  expiresIn: number
  customExpiry: string
  burn_on_read: boolean
  password: string
  tag: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  webhook_url: string
  og_title: string
  og_description: string
  og_image: string
}

export interface LinkStats {
  visits: number
  countries: Array<{ country: string; count: number }>
  referrers: Array<{ referer: string; count: number }>
}

export interface GlobalStats {
  totalVisits: number
  hourlyVisits: number
  mood: string
}
