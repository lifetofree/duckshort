import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { AnimatePresence } from 'motion/react'
import type { Link, AdminTab, GlobalStats, LinkStats } from '../components/admin/types'
import AdminAuthGate from '../components/admin/AdminAuthGate'
import AdminTabs from '../components/admin/AdminTabs'
import { apiFetch } from '../lib/api-fetch'

// 2.4: code-split each Admin tab so the initial Admin route only loads the
// LinkTable (the default tab). Switching to Create / Stats / Per-link stats
// triggers a lazy chunk fetch — cuts the Admin page first-paint cost.
const LinkTable = lazy(() => import('../components/admin/LinkTable'))
const LinkCreateForm = lazy(() => import('../components/admin/LinkCreateForm'))
const GlobalStatsView = lazy(() => import('../components/admin/GlobalStatsView'))
const PerLinkStatsView = lazy(() => import('../components/admin/PerLinkStatsView'))
// 2.2: substantial skeleton for the Links tab first-paint. Shown via the
// Suspense fallback so the user sees a styled shell while the chunk + DB
// fetch resolve.
const LinkTableSkeleton = lazy(() => import('../components/admin/LinkTableSkeleton'))

const TabFallback = () => (
  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '2px' }}>
    LOADING TAB…
  </div>
)

const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [tab, setTab] = useState<AdminTab>('links')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set())
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'expired'>('all')
  const [selectedLinkForStats, setSelectedLinkForStats] = useState<string | null>(null)
  const [linkStats, setLinkStats] = useState<LinkStats | null>(null)
  const [statsLimit, setStatsLimit] = useState(10)

  const [allLinks, setAllLinks] = useState<Link[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const fetchLinks = async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true)
    setError(null)
    try {
      const cursorParam = append && allLinks.length > 0 ? `?cursor=${encodeURIComponent(allLinks[allLinks.length - 1].created_at)}` : ''
      const res = await fetch(`${API}/api/links${cursorParam}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Failed to fetch links: ${res.status} ${res.statusText}`)
      const data = await res.json() as { links: Link[]; nextCursor: string | null }
      if (append) setAllLinks(prev => [...prev, ...data.links]); else setAllLinks(data.links)
      setHasMore(!!data.nextCursor)
    } catch (err) {
      console.error('Failed to fetch links', err)
      setError(err instanceof Error ? err.message : 'Failed to load links')
    } finally {
      if (append) setLoadingMore(false); else setLoading(false)
    }
  }

  const fetchGlobalStats = async () => {
    try {
      const res = await fetch(`${API}/api/stats/global`)
      const data = await res.json()
      setGlobalStats(data)
    } catch (err) {
      console.error('Failed to fetch global stats', err)
    }
  }

  const fetchLinkStats = async (linkId: string, limit: number = statsLimit) => {
    try {
      console.log('[DEBUG] fetchLinkStats called', { linkId, limit })
      const res = await fetch(`${API}/api/stats/${linkId}?limit=${limit}`)
      console.log('[DEBUG] fetchLinkStats response', { ok: res.ok, status: res.status })
      if (res.ok) {
        const data = await res.json()
        console.log('[DEBUG] fetchLinkStats data', JSON.stringify(data).slice(0, 100))
        setLinkStats(data)
        console.log('[DEBUG] setLinkStats called with', typeof data)
      } else {
        console.error('Failed to fetch link stats', { status: res.status, statusText: res.statusText, url: `${API}/api/stats/${linkId}?limit=${limit}` })
      }
    } catch (err) {
      console.error('[DEBUG] fetchLinkStats error', err)
    }
  }

  const handleToggleLink = async (id: string) => {
    try {
      const res = await apiFetch(`${API}/api/links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle' })
      })
      if (res.ok) {
        fetchLinks()
      }
    } catch (err) {
      console.error('Failed to toggle link')
    }
  }

  const handleExtendExpiry = async (id: string, hours: number = 24) => {
    try {
      const res = await apiFetch(`${API}/api/links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend', extendHours: hours })
      })
      if (res.ok) {
        fetchLinks()
      }
    } catch (err) {
      console.error('Failed to extend expiry')
    }
  }

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return

    try {
      const res = await apiFetch(`${API}/api/links/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchLinks()
      }
    } catch (err) {
      console.error('Failed to delete link')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedLinks.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedLinks.size} link(s)?`)) return

    try {
      const res = await apiFetch(`${API}/api/links/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedLinks) })
      })
      if (res.ok) {
        setSelectedLinks(new Set())
        fetchLinks()
      }
    } catch (err) {
      console.error('Failed to bulk delete')
    }
  }

  const handleLogout = async () => {
    try {
      await apiFetch(`${API}/api/logout`, { method: 'POST' })
    } catch { /* ignore */ }
    setIsAuthenticated(false)
  }

  useEffect(() => {
    fetch(`${API}/api/auth/check`, { credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true)
          fetchLinks()
          fetchGlobalStats()
        }
      })
      .catch(() => {})
  }, [])

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const topLinks = useMemo(() =>
    [...allLinks]
      .sort((a, b) => b.sparkline.reduce((s, v) => s + v, 0) - a.sparkline.reduce((s, v) => s + v, 0))
      .slice(0, 6),
    [allLinks]
  )

  const filteredLinks = allLinks.filter(link => {
    const matchesSearch = searchQuery === '' || 
      link.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.original_url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (link.tag && link.tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && !link.disabled && !isExpired(link.expires_at)) ||
      (statusFilter === 'disabled' && link.disabled) ||
      (statusFilter === 'expired' && isExpired(link.expires_at))
    
    return matchesSearch && matchesStatus
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '2rem', fontFamily: 'JetBrains Mono, monospace' }}>
      {!isAuthenticated ? (
        <AdminAuthGate onAuthenticated={() => {
          setIsAuthenticated(true)
          fetchLinks()
          fetchGlobalStats()
        }} />
      ) : (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: 'var(--neon-cyan)', margin: 0 }}>
              ADMIN DASHBOARD
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '2px', marginTop: '0.5rem' }}>
              THE NEON POND CONTROL CENTER
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {globalStats && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '2px' }}>TOTAL VISITS</div>
                <div className="neon-glow-cyan" style={{ fontSize: '1.5rem', color: 'var(--neon-cyan)', fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>
                  {globalStats.totalVisits.toLocaleString()}
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              style={{
                color: 'var(--neon-magenta)',
                textDecoration: 'none',
                fontSize: '0.75rem',
                letterSpacing: '2px',
                border: '1px solid var(--neon-magenta)',
                background: 'transparent',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              LOGOUT
            </button>
            <a href="/" style={{ color: 'var(--neon-cyan)', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '2px', border: '1px solid var(--neon-cyan)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
              ← BACK TO HOME
            </a>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(255, 0, 85, 0.1)', border: '1px solid var(--neon-magenta)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', color: 'var(--neon-magenta)', fontSize: '0.75rem' }}>
            {error}
          </div>
        )}

        <AdminTabs
          tab={tab}
          setTab={setTab}
          selectedLinkForStats={selectedLinkForStats}
          setSelectedLinkForStats={setSelectedLinkForStats}
          fetchLinkStats={fetchLinkStats}
        />

        <AnimatePresence mode="wait">
          {tab === 'links' && (
            <Suspense fallback={<TabFallback />}>
              {loading && allLinks.length === 0 ? (
                <Suspense fallback={<TabFallback />}>
                  <LinkTableSkeleton />
                </Suspense>
              ) : (
                <LinkTable
                  allLinks={allLinks}
                  filteredLinks={filteredLinks}
                  loading={loading}
                  loadingMore={loadingMore}
                  hasMore={hasMore}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  selectedLinks={selectedLinks}
                  setSelectedLinks={setSelectedLinks}
                  onRefresh={() => fetchLinks()}
                  onLoadMore={() => fetchLinks(true)}
                  onBulkDelete={handleBulkDelete}
                  onToggleLink={handleToggleLink}
                  onExtendExpiry={handleExtendExpiry}
                  onDeleteLink={handleDeleteLink}
                  onSelectStats={(id) => {
                    setSelectedLinkForStats(id)
                    setTab('link-stats')
                    fetchLinkStats(id, statsLimit)
                  }}
                />
              )}
            </Suspense>
          )}

          {tab === 'create' && (
            <Suspense fallback={<TabFallback />}>
              <LinkCreateForm onSuccess={() => {
                setTab('links')
                fetchLinks()
              }} />
            </Suspense>
          )}

          {tab === 'stats' && globalStats && (
            <Suspense fallback={<TabFallback />}>
              <GlobalStatsView
                globalStats={globalStats}
                topLinks={topLinks}
                onSelectLink={(id) => {
                  setSelectedLinkForStats(id)
                  setTab('link-stats')
                  fetchLinkStats(id, statsLimit)
                }}
              />
            </Suspense>
          )}

          {tab === 'link-stats' && selectedLinkForStats && (console.log('[DEBUG] render check: tab=link-stats, selectedLinkForStats=', selectedLinkForStats, 'linkStats=', linkStats), true) && linkStats && (
            <Suspense fallback={<TabFallback />}>
              <PerLinkStatsView
                selectedLinkForStats={selectedLinkForStats}
                linkStats={linkStats}
                allLinks={allLinks}
                statsLimit={statsLimit}
                setStatsLimit={setStatsLimit}
                fetchLinkStats={fetchLinkStats}
                onBack={() => {
                  setTab('links')
                  setSelectedLinkForStats(null)
                  setLinkStats(null)
                }}
              />
            </Suspense>
          )}
        </AnimatePresence>
      </div>
      )}
    </div>
  )
}
