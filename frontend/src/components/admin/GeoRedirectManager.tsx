import { useState } from 'react'
import type { GeoRedirect } from './types'

const API = import.meta.env.VITE_API_URL ?? ''

interface GeoRedirectManagerProps {
  linkId: string
  geoRedirects: GeoRedirect[]
  onRefresh: () => void
}

export default function GeoRedirectManager({ linkId, geoRedirects, onRefresh }: GeoRedirectManagerProps) {
  const [newCountry, setNewCountry] = useState('')
  const [newUrl, setNewUrl] = useState('')

  const handleAddGeoRedirect = async () => {
    if (!newCountry.trim() || !newUrl.trim()) return
    try {
      const res = await fetch(`${API}/api/links/${linkId}/geo-redirects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ country_code: newCountry.toUpperCase(), destination_url: newUrl })
      })
      if (res.ok) {
        setNewCountry('')
        setNewUrl('')
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to add geo-redirect')
    }
  }

  const handleDeleteGeoRedirect = async (geoId: string) => {
    try {
      const res = await fetch(`${API}/api/links/geo-redirects/${geoId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to delete geo-redirect')
    }
  }

  return (
    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <h3 style={{ color: 'var(--neon-purple)', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '1rem' }}>
        GEO REDIRECTS FOR {linkId}
      </h3>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
            placeholder="Country Code (e.g. US, TH)"
            maxLength={2}
            style={{
              width: '120px',
              padding: '0.5rem',
              background: 'var(--bg-primary)',
              border: '1px solid rgba(191, 0, 255, 0.3)',
              color: 'var(--neon-purple)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}
          />
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Destination URL"
            style={{
              flex: 1,
              padding: '0.5rem',
              background: 'var(--bg-primary)',
              border: '1px solid rgba(191, 0, 255, 0.3)',
              color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={handleAddGeoRedirect}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--neon-purple)',
              border: 'none',
              color: '#fff',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            ADD
          </button>
        </div>
      </div>
      {geoRedirects.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>No geo-redirects configured</p>
      ) : (
        geoRedirects.map((g) => (
          <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-primary)', marginBottom: '0.5rem', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, overflow: 'hidden' }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--neon-purple)',
                background: 'rgba(191, 0, 255, 0.15)',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid rgba(191, 0, 255, 0.3)',
                flexShrink: 0,
              }}>
                {g.country_code}
              </span>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.destination_url}</span>
            </div>
            <button
              onClick={() => handleDeleteGeoRedirect(g.id)}
              style={{
                padding: '0.35rem 0.7rem',
                background: 'transparent',
                border: '1px solid var(--neon-magenta)',
                color: 'var(--neon-magenta)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem',
                cursor: 'pointer',
                borderRadius: '4px',
                flexShrink: 0,
              }}
            >
              DELETE
            </button>
          </div>
        ))
      )}
    </div>
  )
}
