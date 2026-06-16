export const CUSTOM_ID_MAX_LENGTH = 20
export const CUSTOM_ID_REGEX = /^[a-zA-Z0-9_-]{3,20}$/

export const EXPIRY_OPTIONS = [
  { label: 'Never', value: 0 },
  { label: '1 Hour', value: 3600 },
  { label: '24 Hours', value: 86400 },
  { label: '7 Days', value: 604800 },
  { label: '30 Days', value: 2592000 },
  { label: 'Custom', value: -1 },
] as const
