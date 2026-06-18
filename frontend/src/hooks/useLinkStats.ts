import { useQuery } from '@tanstack/react-query'
import type { LinkStatsData } from './useStatsView'

const API = import.meta.env.VITE_API_URL ?? ''

interface UseLinkStatsResult {
  stats: LinkStatsData | undefined
  isLoading: boolean
  error: boolean
}

/**
 * Polls GET /api/stats/:id?limit=N for the per-link view. The query is
 * disabled until the user submits an id (i.e. submittedStatsId is non-null).
 */
export function useLinkStats(submittedStatsId: string | null, limit: number): UseLinkStatsResult {
  const query = useQuery<LinkStatsData>({
    queryKey: ['linkStats', submittedStatsId, limit],
    queryFn: () =>
      fetch(`${API}/api/stats/${submittedStatsId}?limit=${limit}`).then(
        (r) => r.json() as Promise<LinkStatsData>,
      ),
    enabled: !!submittedStatsId,
  })

  return { stats: query.data, isLoading: query.isLoading, error: !!query.error }
}
