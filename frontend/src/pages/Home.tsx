import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import DuckMoodLogo, { type DuckMood } from '../components/DuckMoodLogo'
import { useTranslation } from '../lib/i18n'
import { QuackCounter } from '../components/QuackCounter'
import { ShortenForm } from '../components/ShortenForm'
import { StatsView } from '../components/StatsView'
import { ResultModal } from '../components/ResultModal'
import { CUSTOM_ID_REGEX } from '../lib/constants'

const API = import.meta.env.VITE_API_URL ?? ''

type Tab = 'shorten' | 'stats'

export default function HomePage() {
  const { t: translate } = useTranslation()
  const [tab, setTab] = useState<Tab>('shorten')

  const [url, setUrl] = useState('')
  const [customId, setCustomId] = useState('')
  const [burnOnRead, setBurnOnRead] = useState(false)
  const [expiry, setExpiry] = useState(0)
  const [customExpiry, setCustomExpiry] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const [statsId, setStatsId] = useState('')
  const [statsLimit, setStatsLimit] = useState(10)
  const [submittedStatsId, setSubmittedStatsId] = useState<string | null>(null)

  const { data: globalStats, error: globalStatsError } = useQuery({
    queryKey: ['globalStats'],
    queryFn: () => fetch(`${API}/api/stats/global`).then(r => r.json()),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })

  const { data: stats, isLoading: statsLoading, error: statsQueryError } = useQuery({
    queryKey: ['linkStats', submittedStatsId, statsLimit],
    queryFn: () => fetch(`${API}/api/stats/${submittedStatsId}?limit=${statsLimit}`).then(r => r.json()),
    enabled: !!submittedStatsId,
  })

  const totalVisits = globalStats?.totalVisits ?? null
  const mood: DuckMood = globalStatsError ? 'ERROR' : (globalStats?.mood as DuckMood) ?? 'ACTIVE'
  const statsError = statsQueryError ? translate('home.statsForm.error') : stats?.error ?? null

  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    try { new URL(url) } catch {
      setError(translate('home.shortenForm.errors.invalidUrl'))
      return
    }
    if (customId.trim() && !CUSTOM_ID_REGEX.test(customId.trim())) {
      setError(translate('home.shortenForm.errors.invalidCustomId'))
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const expiresIn = expiry === -1
        ? (parseInt(customExpiry, 10) * 3600 || undefined)
        : (expiry || undefined)
      const res = await fetch(`${API}/api/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url, customId: customId.trim() || undefined, burn_on_read: burnOnRead, expiresIn }),
      })
      const data = await res.json()
      if (res.ok) {
        setShortUrl(data.shortUrl)
        setCustomId('')
        setBurnOnRead(false)
      } else {
        setError(data.error ?? translate('home.shortenForm.errors.failedToShorten', { status: res.status }))
      }
    } catch (err) {
      console.error('Shorten error:', err)
      setError(translate('home.shortenForm.errors.networkError'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewStats = async (e: React.FormEvent) => {
    e.preventDefault()
    let id = statsId.trim()
    if (!id) return
    try {
      const urlObj = new URL(id)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      if (pathParts.length > 0) id = pathParts[pathParts.length - 1]
    } catch { /* not a URL, use as-is */ }
    setSubmittedStatsId(id)
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
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem',
        background: 'var(--bg-primary)',
        paddingTop: import.meta.env.MODE === 'development' ? '5rem' : '3rem',
      }}
    >
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ margin: '0 auto 1.75rem' }}>
          <DuckMoodLogo mood={mood} />
        </div>
        <h1
          style={{
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
            fontSize: 'clamp(2.2rem, 6vw, 3.2rem)', letterSpacing: '6px',
            lineHeight: 1, margin: '0 0 0.85rem', textTransform: 'uppercase',
          }}
        >
          <span style={{ color: '#ffffff' }}>{translate('home.title.duck')} </span>
          <span className="neon-glow-magenta" style={{ color: 'var(--neon-magenta)' }}>{translate('home.title.short')}</span>
        </h1>
        <p
          className="neon-glow-cyan"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, fontSize: '0.72rem', letterSpacing: '4px', color: 'var(--neon-cyan)', textTransform: 'uppercase', margin: 0 }}
        >
          {translate('home.tagline')}
        </p>
        {totalVisits !== null && <QuackCounter totalVisits={totalVisits} />}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
        className="glass-card"
        style={{ width: '100%', maxWidth: '560px', borderRadius: '14px', overflow: 'hidden' }}
      >
        <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid rgba(0, 242, 255, 0.1)', padding: '0 1.75rem' }}>
          {(['shorten', 'stats'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              id={`tab-${t}`}
              onClick={() => { setTab(t); setError(null) }}
              style={{
                padding: '1.1rem 0.5rem', marginRight: '1.75rem', background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--neon-cyan)' : '2px solid transparent',
                color: tab === t ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.72rem',
                letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
                transition: 'color 0.2s, border-color 0.2s', marginBottom: '-1px',
              }}
            >
              {t === 'shorten' ? translate('home.tabs.shorten') : translate('home.tabs.viewStats')}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'shorten' ? (
            <motion.div key="shorten" role="tabpanel" id="panel-shorten" aria-labelledby="tab-shorten" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} style={{ padding: '1.75rem' }}>
              <ShortenForm
                url={url} onUrlChange={setUrl}
                customId={customId} onCustomIdChange={setCustomId}
                burnOnRead={burnOnRead} onBurnOnReadChange={setBurnOnRead}
                expiry={expiry} onExpiryChange={setExpiry}
                customExpiry={customExpiry} onCustomExpiryChange={setCustomExpiry}
                isLoading={isLoading} error={error}
                onSubmit={handleShorten}
              />
            </motion.div>
          ) : (
            <motion.div key="stats" role="tabpanel" id="panel-stats" aria-labelledby="tab-stats" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} style={{ padding: '1.75rem' }}>
              <StatsView
                statsId={statsId} onStatsIdChange={setStatsId}
                statsLoading={statsLoading} statsError={statsError}
                stats={stats} onSubmit={handleViewStats}
                statsLimit={statsLimit} onStatsLimitChange={setStatsLimit}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        style={{ fontSize: '0.6rem', letterSpacing: '3px', color: 'var(--text-secondary)', textTransform: 'uppercase', opacity: 0.5, textAlign: 'center', marginTop: '2.5rem', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {translate('home.footer', { version: __APP_VERSION__ })} - {translate('poweredBy')}
      </motion.p>

      {shortUrl && (
        <ResultModal
          shortUrl={shortUrl} copySuccess={copySuccess}
          onCopy={handleCopy}
          onClose={() => { setShortUrl(null); setCopySuccess(false) }}
        />
      )}
    </div>
  )
}
