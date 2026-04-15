import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import logo from '../assets/logo.png'

const API = import.meta.env.VITE_API_URL ?? ''
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET ?? ''

type Tab = 'shorten' | 'stats'

const EXPIRY_OPTIONS = [
  { label: 'NEVER', value: 0 },
  { label: '1 HOUR', value: 3600 },
  { label: '24 HOURS', value: 86400 },
  { label: '7 DAYS', value: 604800 },
  { label: '30 DAYS', value: 2592000 },
]

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('shorten')

  const [url, setUrl] = useState('')
  const [expiry, setExpiry] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const [statsId, setStatsId] = useState('')
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [stats, setStats] = useState<any | null>(null)

  useEffect(() => {
    const p = fetch(`${API}/api/stats/global`)
    if (!p || typeof p.then !== 'function') return
    p.then((r) => r.json())
      .then((d) => console.log('Global stats:', d.totalVisits))
      .catch(() => null)
  }, [shortUrl])

  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    try { new URL(url) } catch {
      setError('Invalid URL format')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_SECRET}` },
        body: JSON.stringify({ url, expiresIn: expiry || undefined }),
      })
      const data = await res.json()
      if (data.shortUrl) setShortUrl(data.shortUrl)
      else setError(data.error ?? 'Failed to shorten URL')
    } catch {
      setError('Network error. Check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewStats = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!statsId.trim()) return
    setStatsLoading(true)
    setStatsError(null)
    setStats(null)
    try {
      const res = await fetch(`${API}/api/stats/${statsId.trim()}`)
      const data = await res.json()
      if (data.error) setStatsError(data.error)
      else setStats(data)
    } catch {
      setStatsError('Network error.')
    } finally {
      setStatsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shortUrl) return
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1rem',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Header: Logo + Title + Tagline */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: '2.5rem' }}
      >
        <img
          src={logo}
          alt="DuckShort"
          style={{
            display: 'block',
            width: '140px',
            height: '140px',
            objectFit: 'cover',
            borderRadius: '50%',
            border: '3px solid rgba(0, 242, 255, 0.45)',
            boxShadow:
              '0 0 18px rgba(0, 242, 255, 0.4), 0 0 50px rgba(0, 242, 255, 0.15), inset 0 0 12px rgba(0, 242, 255, 0.08)',
            margin: '0 auto 1.75rem',
          }}
        />

        <h1
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(2.2rem, 6vw, 3.2rem)',
            letterSpacing: '6px',
            lineHeight: 1,
            margin: '0 0 0.85rem',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: '#ffffff' }}>DUCK </span>
          <span className="neon-glow-magenta" style={{ color: 'var(--neon-magenta)' }}>
            SHORT
          </span>
        </h1>

        <p
          className="neon-glow-cyan"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 500,
            fontSize: '0.72rem',
            letterSpacing: '4px',
            color: 'var(--neon-cyan)',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          REDIRECTING AT THE SPEED OF LIGHT
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(0, 242, 255, 0.1)',
            padding: '0 1.75rem',
          }}
        >
          {(['shorten', 'stats'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                setError(null)
                setStatsError(null)
              }}
              style={{
                padding: '1.1rem 0.5rem',
                marginRight: '1.75rem',
                background: 'none',
                border: 'none',
                borderBottom:
                  tab === t
                    ? '2px solid var(--neon-cyan)'
                    : '2px solid transparent',
                color: tab === t ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: '0.72rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'color 0.2s, border-color 0.2s',
                marginBottom: '-1px',
              }}
            >
              {t === 'shorten' ? 'SHORTEN' : 'VIEW STATS'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {tab === 'shorten' ? (
            <motion.div
              key="shorten"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              style={{ padding: '1.75rem' }}
            >
              <form
                onSubmit={handleShorten}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="PASTE YOUR LONG URL HERE..."
                  disabled={isLoading}
                  required
                  className="input-neon"
                  style={{
                    width: '100%',
                    padding: '1.05rem 1.25rem',
                    borderRadius: '10px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.78rem',
                    letterSpacing: '1px',
                  }}
                />

                {/* Expiry selector */}
                <div
                  className="input-neon"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.9rem 1.25rem',
                    borderRadius: '10px',
                    gap: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.65rem',
                      letterSpacing: '2px',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    EXPIRY:
                  </span>
                  <select
                    value={expiry}
                    onChange={(e) => setExpiry(Number(e.target.value))}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--neon-cyan)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      letterSpacing: '2px',
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      textTransform: 'uppercase',
                    }}
                  >
                    {EXPIRY_OPTIONS.map((o) => (
                      <option
                        key={o.value}
                        value={o.value}
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--neon-cyan)' }}
                      >
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    ▾
                  </span>
                </div>

                {error && (
                  <p
                    style={{
                      color: 'var(--error)',
                      fontSize: '0.75rem',
                      letterSpacing: '1px',
                      fontFamily: 'JetBrains Mono, monospace',
                      margin: 0,
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !url.trim()}
                  className="btn-neon"
                  style={{
                    width: '100%',
                    padding: '1.15rem',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontFamily: 'Orbitron, sans-serif',
                    fontWeight: 900,
                    fontSize: '1.05rem',
                    letterSpacing: '5px',
                    textTransform: 'uppercase',
                    cursor: isLoading || !url.trim() ? 'not-allowed' : 'pointer',
                    opacity: isLoading || !url.trim() ? 0.5 : 1,
                  }}
                >
                  {isLoading ? 'PROCESSING...' : 'SHORTEN!'}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              style={{
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              <form onSubmit={handleViewStats} style={{ display: 'flex', gap: '0.65rem' }}>
                <input
                  type="text"
                  value={statsId}
                  onChange={(e) => setStatsId(e.target.value)}
                  placeholder="ENTER LINK ID OR SHORT CODE..."
                  required
                  className="input-neon"
                  style={{
                    flex: 1,
                    padding: '1.05rem 1.25rem',
                    borderRadius: '10px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.75rem',
                    letterSpacing: '1px',
                  }}
                />
                <button
                  type="submit"
                  disabled={statsLoading || !statsId.trim()}
                  className="btn-neon"
                  style={{
                    padding: '1.05rem 1.5rem',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontFamily: 'Orbitron, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    letterSpacing: '2px',
                    cursor: statsLoading || !statsId.trim() ? 'not-allowed' : 'pointer',
                    opacity: statsLoading || !statsId.trim() ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {statsLoading ? '...' : 'GO'}
                </button>
              </form>

              {statsError && (
                <p
                  style={{
                    color: 'var(--error)',
                    fontSize: '0.75rem',
                    letterSpacing: '1px',
                    fontFamily: 'JetBrains Mono, monospace',
                    margin: 0,
                  }}
                >
                  {statsError}
                </p>
              )}

              {stats && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.85rem 1.25rem',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '10px',
                      border: '1px solid rgba(0, 242, 255, 0.12)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.65rem',
                        letterSpacing: '2px',
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      TOTAL VISITS
                    </span>
                    <span
                      className="neon-glow-cyan"
                      style={{
                        fontFamily: 'Orbitron, sans-serif',
                        fontSize: '1.5rem',
                        color: 'var(--neon-cyan)',
                        fontWeight: 700,
                      }}
                    >
                      {stats.visits}
                    </span>
                  </div>

                  {stats.countries?.length > 0 && (
                    <div>
                      <p
                        style={{
                          fontSize: '0.6rem',
                          letterSpacing: '2px',
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          marginBottom: '0.5rem',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        TOP COUNTRIES
                      </p>
                      {stats.countries.slice(0, 5).map((c: any) => (
                        <div
                          key={c.country}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0',
                            fontSize: '0.8rem',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          <span style={{ color: 'var(--text-primary)' }}>{c.country}</span>
                          <span
                            style={{
                              color: 'var(--neon-cyan)',
                              fontFamily: 'JetBrains Mono, monospace',
                            }}
                          >
                            {c.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {stats.referrers?.length > 0 && (
                    <div>
                      <p
                        style={{
                          fontSize: '0.6rem',
                          letterSpacing: '2px',
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          marginBottom: '0.5rem',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        TOP REFERRERS
                      </p>
                      {stats.referrers.slice(0, 5).map((r: any) => (
                        <div
                          key={r.referer}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0',
                            fontSize: '0.75rem',
                            gap: '1rem',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          <span
                            style={{
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {r.referer}
                          </span>
                          <span
                            style={{
                              color: 'var(--neon-cyan)',
                              flexShrink: 0,
                              fontFamily: 'JetBrains Mono, monospace',
                            }}
                          >
                            {r.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{
          fontSize: '0.6rem',
          letterSpacing: '3px',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          opacity: 0.5,
          textAlign: 'center',
          marginTop: '2.5rem',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        V1.0.0-PROTOTYPE &nbsp;&nbsp;&nbsp;SECURED BY D1 &nbsp;&nbsp;&nbsp;EDGE-NATIVE
      </motion.p>

      {/* Result Modal */}
      {shortUrl && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 12, 18, 0.92)',
            backdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => {
            setShortUrl(null)
            setCopySuccess(false)
          }}
        >
          <div
            className="modal-content glass-card-neon"
            style={{
              padding: '2rem',
              width: '100%',
              maxWidth: '440px',
              borderRadius: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: '0.85rem',
                letterSpacing: '3px',
                color: 'var(--neon-cyan)',
                textTransform: 'uppercase',
                marginBottom: '1.5rem',
              }}
            >
              LINK CREATED
            </h2>

            <div
              style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}
            >
              <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '10px' }}>
                <QRCodeSVG value={shortUrl} size={130} level="M" />
              </div>
            </div>

            <p
              style={{
                fontSize: '0.6rem',
                letterSpacing: '1px',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                marginBottom: '0.5rem',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              YOUR SHORT URL
            </p>
            <input
              type="text"
              readOnly
              value={shortUrl}
              className="input-neon"
              style={{
                width: '100%',
                padding: '0.85rem 1.25rem',
                borderRadius: '10px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.9rem',
                marginBottom: '0.85rem',
              }}
            />

            <button
              onClick={handleCopy}
              className="btn-neon"
              style={{
                width: '100%',
                padding: '1rem',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 700,
                fontSize: '0.8rem',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                marginBottom: '1.25rem',
                opacity: copySuccess ? 0.85 : 1,
              }}
            >
              {copySuccess ? 'COPIED!' : 'COPY TO CLIPBOARD'}
            </button>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(0, 242, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--neon-cyan)',
                    boxShadow: '0 0 6px var(--neon-cyan)',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.6rem',
                    letterSpacing: '1px',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  Transfer_Complete
                </span>
              </div>
              <button
                onClick={() => {
                  setShortUrl(null)
                  setCopySuccess(false)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.6rem',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
