import { useQuery } from '@tanstack/react-query'
import type { DuckMood } from '../components/DuckMoodLogo'

const API = import.meta.env.VITE_API_URL ?? ''

export type GlobalStats = {
  totalVisits: number
  hourlyVisits: number
  mood: DuckMood
  /** Bumped when the server rolls over or after a deploy so the UI can show a banner */
  generatedAt?: string
}

interface UseGlobalStatsResult {
  totalVisits: number | null
  mood: DuckMood
  error: boolean
  isLoading: boolean
}

/**
 * Lightweight wrapper around react-query for the GET /api/stats/global poll.
 * Centralises:
 *  - the query key
 *  - the 30s refetch interval
 *  - the refetch-on-window-focus behaviour
 *  - the error → DuckMood "ERROR" mapping
 *
 * Components that need the raw data can spread `...query`; the result
 * shape here is the high-level view that <Home /> cares about.
 */
export function useGlobalStats(): UseGlobalStatsResult {
  const query = useQuery<GlobalStats>({
    queryKey: ['globalStats'],
    queryFn: () => fetch(`${API}/api/stats/global`).then((r) => r.json() as Promise<GlobalStats>),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })

  return {
    totalVisits: query.data?.totalVisits ?? null,
    mood: query.error ? 'ERROR' : (query.data?.mood ?? 'ACTIVE'),
    error: !!query.error,
    isLoading: query.isLoading,
  }
}
