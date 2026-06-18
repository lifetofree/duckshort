import { useState } from 'react'
import { motion } from 'motion/react'
import type { Link, Variant, GeoRedirect } from './types'
import VariantManager from './VariantManager'
import GeoRedirectManager from './GeoRedirectManager'

const API = import.meta.env.VITE_API_URL ?? ''

interface LinkTableProps {
  allLinks: Link[]
  filteredLinks: Link[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  searchQuery: string
  setSearchQuery: (query: string) => void
  statusFilter: 'all' | 'active' | 'disabled' | 'expired'
  setStatusFilter: (filter: 'all' | 'active' | 'disabled' | 'expired') => void
  selectedLinks: Set<string>
  setSelectedLinks: (links: Set<string>) => void
  onRefresh: () => void
  onLoadMore: () => void
  onBulkDelete: () => void
  onToggleLink: (id: string) => void
  onExtendExpiry: (id: string) => void
  onDeleteLink: (id: string) => void
  onSelectStats: (id: string) => void
}

export default function LinkTable({
  allLinks,
  filteredLinks,
  loading,
  loadingMore,
  hasMore,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  selectedLinks,
  setSelectedLinks,
  onRefresh,
  onLoadMore,
  onBulkDelete,
  onToggleLink,
  onExtendExpiry,
  onDeleteLink,
  onSelectStats,
}: LinkTableProps) {
  const [showVariants, setShowVariants] = useState<string | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [showGeoRedirects, setShowGeoRedirects] = useState<string | null>(null)
  const [geoRedirects, setGeoRedirects] = useState<GeoRedirect[]>([])

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const fetchVariants = async (linkId: string) => {
    try {
      const res = await fetch(`${API}/api/links/${linkId}/variants`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setVariants(data)
      }
    } catch (err) {
      console.error('Failed to fetch variants')
    }
  }

  const fetchGeoRedirects = async (linkId: string) => {
    try {
      const res = await fetch(`${API}/api/links/${linkId}/geo-redirects`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setGeoRedirects(data)
      }
    } catch (err) {
      console.error('Failed to fetch geo-redirects')
    }
  }

  const handleExportCSV = async () => {
    try {
      const res = await fetch(`${API}/api/links/export`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'duckshort-export.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to export CSV')
    }
  }

  return (
    <motion.div key="links" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input
            type="checkbox"
            checked={selectedLinks.size === filteredLinks.length && filteredLinks.length > 0}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedLinks(new Set(filteredLinks.map(l => l.id)))
              } else {
                setSelectedLinks(new Set())
              }
            }}
            style={{ accentColor: 'var(--neon-cyan)' }}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
            {selectedLinks.size > 0 ? `${selectedLinks.size} selected` : 'Select all'}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '300px' }}>
          <input
            type="text"
            placeholder="Search links..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid rgba(0, 242, 255, 0.2)',
              color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              borderRadius: '6px',
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid rgba(0, 242, 255, 0.2)',
              color: 'var(--neon-cyan)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              borderRadius: '6px',
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {selectedLinks.size > 0 && (
            <button
              onClick={onBulkDelete}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--neon-magenta)',
                border: 'none',
                color: '#fff',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.7rem',
                letterSpacing: '1px',
                cursor: 'pointer',
                borderRadius: '6px',
              }}
            >
              DELETE SELECTED
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid rgba(0, 242, 255, 0.3)',
              color: 'var(--neon-cyan)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              letterSpacing: '1px',
              cursor: loading ? 'not-allowed' : 'pointer',
              borderRadius: '6px',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'REFRESHING...' : 'REFRESH'}
          </button>
          <button
            onClick={handleExportCSV}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid rgba(0, 242, 255, 0.3)',
              color: 'var(--neon-cyan)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              letterSpacing: '1px',
              cursor: 'pointer',
              borderRadius: '6px',
            }}
          >
            EXPORT CSV
          </button>
        </div>
      </div>
      
      <div style={{ marginBottom: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
        Showing {filteredLinks.length} of {allLinks.length} links
      </div>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0, 242, 255, 0.1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 120px 1fr 180px 100px 100px 120px 140px', gap: '1rem', padding: '1rem', borderBottom: '1px solid rgba(0, 242, 255, 0.1)', background: 'var(--bg-tertiary)', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          <div></div>
          <div>ID</div>
          <div>Original URL</div>
          <div>Created</div>
          <div>Expires</div>
          <div>Status</div>
          <div>Tag</div>
          <div>Actions</div>
        </div>
        {filteredLinks.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔍</div>
            <div style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>NO LINKS FOUND</div>
            <div style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>Try adjusting your search or filters</div>
          </div>
        ) : (
          filteredLinks.map((link) => (
            <div
              key={link.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 120px 1fr 180px 100px 100px 120px 140px',
                gap: '1rem',
                padding: '1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                alignItems: 'center',
                fontSize: '0.75rem',
                background: link.disabled ? 'rgba(255, 0, 85, 0.05)' : 'transparent',
              }}
            >
            <input
              type="checkbox"
              checked={selectedLinks.has(link.id)}
              onChange={(e) => {
                const newSelected = new Set(selectedLinks)
                if (e.target.checked) {
                  newSelected.add(link.id)
                } else {
                  newSelected.delete(link.id)
                }
                setSelectedLinks(newSelected)
              }}
              style={{ accentColor: 'var(--neon-cyan)' }}
            />
            <div style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{link.id}</div>
            <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {link.original_url}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>{new Date(link.created_at).toLocaleDateString()}</div>
            <div style={{ color: isExpired(link.expires_at) ? 'var(--neon-magenta)' : 'var(--text-secondary)' }}>
              {link.expires_at ? new Date(link.expires_at).toLocaleDateString() : 'Never'}
            </div>
            <div>
              {link.disabled ? (
                <span style={{ color: 'var(--neon-magenta)', fontSize: '0.65rem', letterSpacing: '1px' }}>DISABLED</span>
              ) : isExpired(link.expires_at) ? (
                <span style={{ color: 'var(--neon-magenta)', fontSize: '0.65rem', letterSpacing: '1px' }}>EXPIRED</span>
              ) : (
                <span style={{ color: '#00ff88', fontSize: '0.65rem', letterSpacing: '1px' }}>ACTIVE</span>
              )}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>{link.tag || '-'}</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => onSelectStats(link.id)}
                style={{
                  padding: '0.35rem 0.7rem',
                  background: 'var(--neon-purple)',
                  border: 'none',
                  color: '#fff',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.65rem',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                STATS
              </button>
              <button
                onClick={() => onToggleLink(link.id)}
                style={{
                  padding: '0.35rem 0.7rem',
                  background: link.disabled ? 'var(--neon-cyan)' : 'var(--neon-magenta)',
                  border: 'none',
                  color: '#fff',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.65rem',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                {link.disabled ? 'ENABLE' : 'DISABLE'}
              </button>
              {!link.disabled && isExpired(link.expires_at) && (
                <button
                  onClick={() => onExtendExpiry(link.id)}
                  style={{
                    padding: '0.35rem 0.7rem',
                    background: '#00ff88',
                    border: 'none',
                    color: '#000',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.65rem',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                  }}
                >
                  +24H
                </button>
              )}
              <button
                onClick={() => {
                  if (showVariants === link.id) {
                    setShowVariants(null)
                  } else {
                    setShowVariants(link.id)
                    fetchVariants(link.id)
                  }
                }}
                style={{
                  padding: '0.35rem 0.7rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid rgba(0, 242, 255, 0.3)',
                  color: 'var(--neon-cyan)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.65rem',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                A/B
              </button>
              <button
                onClick={() => {
                  if (showGeoRedirects === link.id) {
                    setShowGeoRedirects(null)
                  } else {
                    setShowGeoRedirects(link.id)
                    fetchGeoRedirects(link.id)
                  }
                }}
                style={{
                  padding: '0.35rem 0.7rem',
                  background: showGeoRedirects === link.id ? 'rgba(191, 0, 255, 0.3)' : 'var(--bg-tertiary)',
                  border: '1px solid rgba(191, 0, 255, 0.4)',
                  color: 'var(--neon-purple)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.65rem',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                GEO
              </button>
              <button
                onClick={() => onDeleteLink(link.id)}
                style={{
                  padding: '0.35rem 0.7rem',
                  background: 'transparent',
                  border: '1px solid var(--neon-magenta)',
                  color: 'var(--neon-magenta)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.65rem',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                DELETE
              </button>
            </div>
          </div>
            ))
        )}
        {showVariants && (
          <VariantManager
            linkId={showVariants}
            variants={variants}
            onRefresh={() => fetchVariants(showVariants)}
          />
        )}
        {showGeoRedirects && (
          <GeoRedirectManager
            linkId={showGeoRedirects}
            geoRedirects={geoRedirects}
            onRefresh={() => fetchGeoRedirects(showGeoRedirects)}
          />
        )}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{
              padding: '0.75rem 2rem',
              background: loadingMore ? 'var(--bg-tertiary)' : 'rgba(0, 242, 255, 0.1)',
              border: '1px solid rgba(0, 242, 255, 0.3)',
              color: 'var(--neon-cyan)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              letterSpacing: '1px',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              borderRadius: '6px',
            }}
          >
            {loadingMore ? 'LOADING...' : 'LOAD MORE'}
          </button>
        </div>
      )}
    </motion.div>
  )
}
