import { useState } from 'react'
import type { Variant } from './types'

const API = import.meta.env.VITE_API_URL ?? ''

interface VariantManagerProps {
  linkId: string
  variants: Variant[]
  onRefresh: () => void
}

export default function VariantManager({ linkId, variants, onRefresh }: VariantManagerProps) {
  const [newUrl, setNewUrl] = useState('')
  const [newWeight, setNewWeight] = useState('1')

  const handleAddVariant = async () => {
    if (!newUrl.trim()) return
    try {
      const res = await fetch(`${API}/api/links/${linkId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ destination_url: newUrl, weight: parseInt(newWeight) || 1 })
      })
      if (res.ok) {
        setNewUrl('')
        setNewWeight('1')
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to add variant')
    }
  }

  const handleDeleteVariant = async (variantId: string) => {
    try {
      const res = await fetch(`${API}/api/links/variants/${variantId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to delete variant')
    }
  }

  return (
    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <h3 style={{ color: 'var(--neon-cyan)', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '1rem' }}>
        A/B VARIANTS FOR {linkId}
      </h3>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Destination URL"
            style={{
              flex: 1,
              padding: '0.5rem',
              background: 'var(--bg-primary)',
              border: '1px solid rgba(0, 242, 255, 0.2)',
              color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              borderRadius: '4px',
            }}
          />
          <input
            type="number"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="Weight"
            min="1"
            style={{
              width: '80px',
              padding: '0.5rem',
              background: 'var(--bg-primary)',
              border: '1px solid rgba(0, 242, 255, 0.2)',
              color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={handleAddVariant}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--neon-cyan)',
              border: 'none',
              color: '#000',
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
      {variants.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>No variants configured</p>
      ) : (
        variants.map((v) => (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-primary)', marginBottom: '0.5rem', borderRadius: '4px' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.destination_url}</div>
              <div style={{ color: 'var(--neon-cyan)', fontSize: '0.65rem' }}>Weight: {v.weight}</div>
            </div>
            <button
              onClick={() => handleDeleteVariant(v.id)}
              style={{
                padding: '0.35rem 0.7rem',
                background: 'transparent',
                border: '1px solid var(--neon-magenta)',
                color: 'var(--neon-magenta)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem',
                cursor: 'pointer',
                borderRadius: '4px',
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
