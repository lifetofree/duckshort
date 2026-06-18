import { useCallback, useState } from 'react'

const MAX_STATS_LIMIT = 100
const DEFAULT_STATS_LIMIT = 10

export type LinkStatsData = {
  visits?: number
  countries?: Array<{ country: string; count: number }>
  referrers?: Array<{ referer: string; count: number }>
  sparkline?: number[]
  error?: string
}

interface UseStatsViewResult {
  statsId: string
  statsLimit: number
  submittedStatsId: string | null
  setStatsId: (v: string) => void
  setStatsLimit: (v: number) => void
  setSubmittedStatsId: (v: string | null) => void
  handleViewStats: (e: React.FormEvent) => void
}

/**
 * Encapsulates the per-link stats form state. Accepts either a raw id
 * ("abc12345") or a full URL ("https://duck.cc/abc12345") and extracts
 * the last path segment before submitting.
 */
export function useStatsView(): UseStatsViewResult {
  const [statsId, setStatsId] = useState('')
  const [statsLimit, setStatsLimit] = useState(DEFAULT_STATS_LIMIT)
  const [submittedStatsId, setSubmittedStatsId] = useState<string | null>(null)

  const handleViewStats = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      let id = statsId.trim()
      if (!id) return
      try {
        const urlObj = new URL(id)
        const pathParts = urlObj.pathname.split('/').filter(Boolean)
        if (pathParts.length > 0) id = pathParts[pathParts.length - 1]
      } catch {
        /* not a URL — use as-is */
      }
      setSubmittedStatsId(id)
    },
    [statsId],
  )

  // Clamp limit to safe range so the SPA never sends ?limit=99999 to the API.
  const safeSetLimit = useCallback((v: number) => {
    if (!Number.isFinite(v) || v < 1) v = 1
    if (v > MAX_STATS_LIMIT) v = MAX_STATS_LIMIT
    setStatsLimit(v)
  }, [])

  return {
    statsId,
    statsLimit,
    submittedStatsId,
    setStatsId,
    setStatsLimit: safeSetLimit,
    setSubmittedStatsId,
    handleViewStats,
  }
}
