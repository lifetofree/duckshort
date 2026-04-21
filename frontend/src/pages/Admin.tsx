import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const API = import.meta.env.VITE_API_URL ?? ''
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET ?? ''

interface Link {
  id: string
  original_url: string
  created_at: string
  expires_at: string | null
  disabled: number
  tag: string | null
  sparkline: number[]
}

interface Variant {
  id: string
  destination_url: string
  weight: number
}

type AdminTab = 'links' | 'create' | 'stats' | 'link-stats'

interface CreateLinkFormData {
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

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(import.meta.env.DEV)
  const [loginInput, setLoginInput] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [tab, setTab] = useState<AdminTab>('links')
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set())
  const [showVariants, setShowVariants] = useState<string | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [globalStats, setGlobalStats] = useState<{ totalVisits: number; hourlyVisits: number; mood: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'expired'>('all')
  const [selectedLinkForStats, setSelectedLinkForStats] = useState<string | null>(null)
  const [linkStats, setLinkStats] = useState<{ visits: number; countries: Array<{ country: string; count: number }>; referrers: Array<{ referer: string; count: number }> } | null>(null)
  const [statsLimit, setStatsLimit] = useState(10)

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

  const EXPIRY_OPTIONS = [
    { label: 'Never', value: 0 },
    { label: '1 Hour', value: 3600 },
    { label: '24 Hours', value: 86400 },
    { label: '7 Days', value: 604800 },
    { label: '30 Days', value: 2592000 },
    { label: 'Custom', value: -1 },
  ]

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (loginInput === ADMIN_SECRET) {
      setIsAuthenticated(true)
      localStorage.setItem('admin_authenticated', 'true')
      setLoginError(null)
      fetchLinks()
      fetchGlobalStats()
    } else {
      setLoginError('Invalid admin secret')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('admin_authenticated')
    setLoginInput('')
  }

  useEffect(() => {
    if (import.meta.env.DEV) {
      fetchLinks()
      fetchGlobalStats()
      return
    }
    const storedAuth = localStorage.getItem('admin_authenticated')
    if (storedAuth === 'true') {
      setIsAuthenticated(true)
      fetchLinks()
      fetchGlobalStats()
    }
  }, [])

  const fetchLinks = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/links`, {
        headers: { Authorization: `Bearer ${ADMIN_SECRET}` }
      })
      if (!res.ok) throw new Error('Failed to fetch links')
      const data = await res.json()
      setLinks(data)
    } catch (err) {
      setError('Failed to load links')
    } finally {
      setLoading(false)
    }
  }

  const fetchGlobalStats = async () => {
    try {
      const res = await fetch(`${API}/api/stats/global`)
      const data = await res.json()
      setGlobalStats(data)
    } catch (err) {
      console.error('Failed to fetch global stats')
    }
  }

  const fetchVariants = async (linkId: string) => {
    try {
      const res = await fetch(`${API}/api/links/${linkId}/variants`, {
        headers: { Authorization: `Bearer ${ADMIN_SECRET}` }
      })
      if (res.ok) {
        const data = await res.json()
        setVariants(data)
      }
    } catch (err) {
      console.error('Failed to fetch variants')
    }
  }

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.url.trim()) return

    try { new URL(formData.url) } catch {
      setError('Invalid URL format')
      return
    }

    if (formData.customId.trim() && !/^[a-zA-Z0-9_-]{3,50}$/.test(formData.customId.trim())) {
      setError('Custom ID must be 3-50 characters (alphanumeric, underscore, hyphen)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const expiresIn = formData.expiresIn === -1
        ? (parseInt(formData.customExpiry, 10) * 3600 || undefined)
        : (formData.expiresIn || undefined)

      const body: any = {
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

      const res = await fetch(`${API}/api/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_SECRET}`
        },
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
      setTab('links')
      fetchLinks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleLink = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/links/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_SECRET}`
        },
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
      const res = await fetch(`${API}/api/links/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_SECRET}`
        },
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
      const res = await fetch(`${API}/api/links/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ADMIN_SECRET}` }
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
      const res = await fetch(`${API}/api/links/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_SECRET}`
        },
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

  const handleAddVariant = async (linkId: string, destinationUrl: string, weight: number) => {
    try {
      const res = await fetch(`${API}/api/links/${linkId}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ADMIN_SECRET}`
        },
        body: JSON.stringify({ destination_url: destinationUrl, weight })
      })
      if (res.ok) {
        fetchVariants(linkId)
      }
    } catch (err) {
      console.error('Failed to add variant')
    }
  }

  const handleDeleteVariant = async (variantId: string) => {
    try {
      const res = await fetch(`${API}/api/links/variants/${variantId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ADMIN_SECRET}` }
      })
      if (res.ok) {
        const linkId = showVariants
        if (linkId) fetchVariants(linkId)
      }
    } catch (err) {
      console.error('Failed to delete variant')
    }
  }

  const isCustomExpiry = formData.expiresIn === -1
  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const fetchLinkStats = async (linkId: string) => {
    try {
      const res = await fetch(`${API}/api/stats/${linkId}?limit=${statsLimit}`)
      if (res.ok) {
        const data = await res.json()
        setLinkStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch link stats')
    }
  }

  const filteredLinks = links.filter(link => {
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
        <div style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '4rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.5rem', color: 'var(--neon-cyan)', marginBottom: '0.5rem' }}>
              ADMIN ACCESS
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '2px' }}>
              ENTER THE NEON POND CONTROL CENTER
            </p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Admin Secret
              </label>
              <input
                type="password"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Enter admin secret"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid rgba(0, 242, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--neon-cyan)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(0, 242, 255, 0.2)'}
              />
            </div>
            {loginError && (
              <div style={{ background: 'rgba(255, 0, 85, 0.1)', border: '1px solid var(--neon-magenta)', padding: '0.75rem', borderRadius: '8px', color: 'var(--neon-magenta)', fontSize: '0.7rem' }}>
                {loginError}
              </div>
            )}
            <button
              type="submit"
              style={{
                padding: '0.85rem',
                background: 'var(--neon-cyan)',
                border: 'none',
                color: '#000',
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: '0.85rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 242, 255, 0.5)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              ENTER
            </button>
          </form>
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <a href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.7rem', letterSpacing: '1px' }}>
              ← BACK TO HOME
            </a>
          </div>
        </div>
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

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          {(['links', 'create', 'stats'] as AdminTab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                if (t === 'links') setSelectedLinkForStats(null)
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: tab === t ? 'var(--neon-cyan)' : 'var(--bg-secondary)',
                border: tab === t ? '1px solid var(--neon-cyan)' : '1px solid rgba(0, 242, 255, 0.2)',
                color: tab === t ? '#000' : 'var(--neon-cyan)',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.2s',
              }}
            >
              {t}
            </button>
          ))}
          {selectedLinkForStats && (
            <button
              onClick={() => {
                setTab('link-stats')
                fetchLinkStats(selectedLinkForStats)
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid rgba(191, 0, 255, 0.3)',
                color: 'var(--neon-purple)',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.2s',
              }}
            >
              LINK STATS
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'links' && (
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
                      onClick={handleBulkDelete}
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
                    onClick={fetchLinks}
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
                </div>
              </div>
              
              <div style={{ marginBottom: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Showing {filteredLinks.length} of {links.length} links
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
                        onClick={() => {
                          setSelectedLinkForStats(link.id)
                          setTab('link-stats')
                          fetchLinkStats(link.id)
                        }}
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
                        onClick={() => handleToggleLink(link.id)}
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
                          onClick={() => handleExtendExpiry(link.id)}
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
                        onClick={() => handleDeleteLink(link.id)}
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
                  <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <h3 style={{ color: 'var(--neon-cyan)', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '1rem' }}>
                      A/B VARIANTS FOR {showVariants}
                    </h3>
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <input
                          type="text"
                          id="variant-url"
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
                          id="variant-weight"
                          placeholder="Weight"
                          defaultValue="1"
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
                          onClick={() => {
                            const urlInput = document.getElementById('variant-url') as HTMLInputElement
                            const weightInput = document.getElementById('variant-weight') as HTMLInputElement
                            if (urlInput?.value && showVariants) {
                              handleAddVariant(showVariants, urlInput.value, parseInt(weightInput?.value) || 1)
                              urlInput.value = ''
                              weightInput.value = '1'
                            }
                          }}
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
                )}
              </div>
            </motion.div>
          )}

          {tab === 'create' && (
            <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '2rem', border: '1px solid rgba(0, 242, 255, 0.1)' }}>
                <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.5rem', color: 'var(--neon-cyan)', marginBottom: '1.5rem' }}>
                  CREATE NEW LINK
                </h2>
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
                        onChange={(e) => setFormData({ ...formData, customId: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
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
          )}

          {tab === 'stats' && globalStats && (
            <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(0, 242, 255, 0.1)' }}>
                  <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>TOTAL VISITS</h3>
                  <div className="neon-glow-cyan" style={{ fontSize: '3rem', color: 'var(--neon-cyan)', fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>
                    {globalStats.totalVisits.toLocaleString()}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(0, 242, 255, 0.1)' }}>
                  <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>HOURLY VISITS</h3>
                  <div className="neon-glow-cyan" style={{ fontSize: '3rem', color: 'var(--neon-cyan)', fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>
                    {globalStats.hourlyVisits.toLocaleString()}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(0, 242, 255, 0.1)' }}>
                  <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>SYSTEM MOOD</h3>
                  <div className="neon-glow-cyan" style={{ fontSize: '3rem', color: 'var(--neon-cyan)', fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>
                    {globalStats.mood}
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '2rem', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(0, 242, 255, 0.1)' }}>
                <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.5rem', color: 'var(--neon-cyan)', marginBottom: '1rem' }}>
                  TOP PERFORMING LINKS
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
                  {links
                    .sort((a, b) => b.sparkline.reduce((sum, val) => sum + val, 0) - a.sparkline.reduce((sum, val) => sum + val, 0))
                    .slice(0, 6)
                    .map((link) => {
                      const totalVisits = link.sparkline.reduce((sum, val) => sum + val, 0)
                      return (
                        <div
                          key={link.id}
                          onClick={() => {
                            setSelectedLinkForStats(link.id)
                            setTab('link-stats')
                            fetchLinkStats(link.id)
                          }}
                          style={{
                            background: 'var(--bg-tertiary)',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 242, 255, 0.1)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--neon-cyan)'}
                          onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(0, 242, 255, 0.1)'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ color: 'var(--neon-cyan)', fontWeight: 700, fontSize: '0.8rem' }}>{link.id}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                              {totalVisits} visits
                            </div>
                          </div>
                          <div style={{ color: 'var(--text-primary)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {link.original_url}
                          </div>
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '2px', height: '20px', alignItems: 'end' }}>
                            {link.sparkline.map((val, i) => (
                              <div
                                key={i}
                                style={{
                                  flex: 1,
                                  background: `rgba(0, 242, 255, ${0.3 + (val / Math.max(...link.sparkline)) * 0.7})`,
                                  height: `${(val / Math.max(...link.sparkline)) * 100}%`,
                                  borderRadius: '2px',
                                  minWidth: '2px',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'link-stats' && selectedLinkForStats && linkStats && (
            <motion.div key="link-stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  onClick={() => {
                    setTab('links')
                    setSelectedLinkForStats(null)
                    setLinkStats(null)
                  }}
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
                  ← BACK TO LINKS
                </button>
              </div>

              <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '2rem', border: '1px solid rgba(0, 242, 255, 0.1)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.5rem', color: 'var(--neon-cyan)', marginBottom: '0.5rem' }}>
                      STATS FOR {selectedLinkForStats}
                    </h2>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', maxWidth: '600px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {links.find(l => l.id === selectedLinkForStats)?.original_url}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '1px' }}>LIMIT:</label>
                    <select
                      value={statsLimit}
                      onChange={(e) => {
                        setStatsLimit(Number(e.target.value))
                        fetchLinkStats(selectedLinkForStats!)
                      }}
                      style={{
                        padding: '0.35rem 0.5rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid rgba(0, 242, 255, 0.2)',
                        color: 'var(--neon-cyan)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.7rem',
                        borderRadius: '4px',
                      }}
                    >
                      <option value={5}>Top 5</option>
                      <option value={10}>Top 10</option>
                      <option value={25}>Top 25</option>
                      <option value={50}>Top 50</option>
                      <option value={100}>Top 100</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>TOTAL VISITS</div>
                    <div className="neon-glow-cyan" style={{ fontSize: '2rem', color: 'var(--neon-cyan)', fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>
                      {linkStats.visits.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ color: 'var(--neon-cyan)', fontSize: '1rem', marginBottom: '1rem', letterSpacing: '1px' }}>
                      TOP COUNTRIES
                    </h3>
                    {linkStats.countries.length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>No country data available</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {linkStats.countries.map((country, i) => (
                          <div
                            key={country.country}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.75rem',
                              background: 'var(--bg-tertiary)',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>#{i + 1}</span>
                              <span style={{ color: 'var(--text-primary)' }}>{country.country || 'Unknown'}</span>
                            </div>
                            <div style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{country.count.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 style={{ color: 'var(--neon-cyan)', fontSize: '1rem', marginBottom: '1rem', letterSpacing: '1px' }}>
                      TOP REFERRERS
                    </h3>
                    {linkStats.referrers.length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>No referrer data available</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {linkStats.referrers.map((referrer, i) => (
                          <div
                            key={referrer.referer}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.75rem',
                              background: 'var(--bg-tertiary)',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                              <span style={{ color: 'var(--neon-cyan)', fontWeight: 700, minWidth: '30px' }}>#{i + 1}</span>
                              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {referrer.referer || 'Direct'}
                              </span>
                            </div>
                            <div style={{ color: 'var(--neon-cyan)', fontWeight: 700, marginLeft: '0.5rem' }}>{referrer.count.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}
    </div>
  )
}
