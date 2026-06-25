import { useState } from 'react'
import { motion } from 'motion/react'
import { EXPIRY_OPTIONS, CUSTOM_ID_REGEX } from '../../lib/constants'
import type { CreateLinkFormData } from './types'
import { apiFetch } from '../../lib/api-fetch'

const API = import.meta.env.VITE_API_URL ?? ''

interface LinkCreateFormProps {
  onSuccess: () => void
}

export default function LinkCreateForm({ onSuccess }: LinkCreateFormProps) {
  const [formData, setFormData] = useState<CreateLinkFormData>({
    url: '',
    customId: '',
    expiresIn: 0,
    customExpiry: '',
    burn_on_read: false,
    password: '',
    tag: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    webhook_url: '',
    og_title: '',
    og_description: '',
    og_image: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustomExpiry = formData.expiresIn === -1

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.url.trim()) return

    try { new URL(formData.url) } catch {
      setError('Invalid URL format')
      return
    }

    if (formData.customId.trim() && !CUSTOM_ID_REGEX.test(formData.customId.trim())) {
      setError('Custom ID must be 3-20 characters (alphanumeric, underscore, hyphen)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const expiresIn = formData.expiresIn === -1
        ? (parseInt(formData.customExpiry, 10) * 3600 || undefined)
        : (formData.expiresIn || undefined)

      const body: Record<string, unknown> = {
        url: formData.url,
        customId: formData.customId.trim() || undefined,
        expiresIn,
        burn_on_read: formData.burn_on_read,
      }

      if (formData.password.trim()) body.password = formData.password
      if (formData.tag.trim()) body.tag = formData.tag
      if (formData.utm_source.trim()) body.utm_source = formData.utm_source
      if (formData.utm_medium.trim()) body.utm_medium = formData.utm_medium
      if (formData.utm_campaign.trim()) body.utm_campaign = formData.utm_campaign
      if (formData.webhook_url.trim()) body.webhook_url = formData.webhook_url
      if (formData.og_title.trim()) body.og_title = formData.og_title
      if (formData.og_description.trim()) body.og_description = formData.og_description
      if (formData.og_image.trim()) body.og_image = formData.og_image

      const res = await apiFetch(`${API}/api/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create link')
      }

      setFormData({
        url: '',
        customId: '',
        expiresIn: 0,
        customExpiry: '',
        burn_on_read: false,
        password: '',
        tag: '',
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        webhook_url: '',
        og_title: '',
        og_description: '',
        og_image: '',
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '2rem', border: '1px solid rgba(0, 242, 255, 0.1)' }}>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.5rem', color: 'var(--neon-cyan)', marginBottom: '1.5rem' }}>
          CREATE NEW LINK
        </h2>
        {error && (
          <div style={{ background: 'rgba(255, 0, 85, 0.1)', border: '1px solid var(--neon-magenta)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', color: 'var(--neon-magenta)', fontSize: '0.7rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleCreateLink} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Original URL *
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com/very-long-url"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid rgba(0, 242, 255, 0.2)',
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.75rem',
                borderRadius: '8px',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Custom ID (Optional)
              </label>
              <input
                type="text"
                value={formData.customId}
                maxLength={20}
                onChange={(e) => setFormData({ ...formData, customId: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) })}
                placeholder="my-custom-link"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Expiry
              </label>
              <select
                value={formData.expiresIn}
                onChange={(e) => setFormData({ ...formData, expiresIn: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--neon-cyan)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                }}
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {isCustomExpiry && (
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Custom Expiry (Hours)
              </label>
              <input
                type="number"
                min="1"
                value={formData.customExpiry}
                onChange={(e) => setFormData({ ...formData, customExpiry: e.target.value })}
                placeholder="24"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Tag (Optional)
            </label>
            <input
              type="text"
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
              placeholder="campaign-name"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid rgba(0, 242, 255, 0.2)',
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.75rem',
                borderRadius: '8px',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Password (Optional)
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Protect with password"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="burn-on-read"
                checked={formData.burn_on_read}
                onChange={(e) => setFormData({ ...formData, burn_on_read: e.target.checked })}
                style={{ accentColor: 'var(--neon-magenta)' }}
              />
              <label htmlFor="burn-on-read" style={{ color: 'var(--text-primary)', fontSize: '0.75rem', letterSpacing: '1px' }}>
                Burn on Read (Self-destruct)
              </label>
            </div>
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <h3 style={{ color: 'var(--neon-cyan)', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '1rem' }}>
              UTM PARAMETERS (Optional)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <input
                type="text"
                value={formData.utm_source}
                onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })}
                placeholder="utm_source"
                style={{
                  padding: '0.5rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.7rem',
                  borderRadius: '6px',
                }}
              />
              <input
                type="text"
                value={formData.utm_medium}
                onChange={(e) => setFormData({ ...formData, utm_medium: e.target.value })}
                placeholder="utm_medium"
                style={{
                  padding: '0.5rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.7rem',
                  borderRadius: '6px',
                }}
              />
              <input
                type="text"
                value={formData.utm_campaign}
                onChange={(e) => setFormData({ ...formData, utm_campaign: e.target.value })}
                placeholder="utm_campaign"
                style={{
                  padding: '0.5rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.7rem',
                  borderRadius: '6px',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <h3 style={{ color: 'var(--neon-cyan)', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '1rem' }}>
              WEBHOOK (Optional)
            </h3>
            <input
              type="url"
              value={formData.webhook_url}
              onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
              placeholder="https://your-webhook-endpoint.com"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--bg-primary)',
                border: '1px solid rgba(0, 242, 255, 0.2)',
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.7rem',
                borderRadius: '6px',
              }}
            />
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <h3 style={{ color: 'var(--neon-cyan)', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '1rem' }}>
              OPEN GRAPH TAGS (Optional)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                value={formData.og_title}
                onChange={(e) => setFormData({ ...formData, og_title: e.target.value })}
                placeholder="OG Title"
                style={{
                  padding: '0.5rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.7rem',
                  borderRadius: '6px',
                }}
              />
              <input
                type="text"
                value={formData.og_description}
                onChange={(e) => setFormData({ ...formData, og_description: e.target.value })}
                placeholder="OG Description"
                style={{
                  padding: '0.5rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.7rem',
                  borderRadius: '6px',
                }}
              />
              <input
                type="url"
                value={formData.og_image}
                onChange={(e) => setFormData({ ...formData, og_image: e.target.value })}
                placeholder="OG Image URL"
                style={{
                  padding: '0.5rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.7rem',
                  borderRadius: '6px',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.url.trim()}
            style={{
              marginTop: '1rem',
              padding: '1rem 2rem',
              background: loading || !formData.url.trim() ? 'var(--bg-tertiary)' : 'var(--neon-cyan)',
              border: 'none',
              color: loading || !formData.url.trim() ? 'var(--text-secondary)' : '#000',
              fontFamily: 'Orbitron, sans-serif',
              fontWeight: 700,
              fontSize: '0.9rem',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: loading || !formData.url.trim() ? 'not-allowed' : 'pointer',
              borderRadius: '8px',
              opacity: loading || !formData.url.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'CREATING...' : 'CREATE LINK'}
          </button>
        </form>
      </div>
    </motion.div>
  )
}
