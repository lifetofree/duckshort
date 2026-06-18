import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import DuckMoodLogo from '../components/DuckMoodLogo'
import { useTranslation } from '../lib/i18n'
import { QuackCounter } from '../components/QuackCounter'
import { ShortenForm } from '../components/ShortenForm'
import { StatsView } from '../components/StatsView'
import { ResultModal } from '../components/ResultModal'
import { useShortenForm } from '../hooks/useShortenForm'
import { useStatsView } from '../hooks/useStatsView'
import { useGlobalStats } from '../hooks/useGlobalStats'
import { useLinkStats } from '../hooks/useLinkStats'

type Tab = 'shorten' | 'stats'

export default function HomePage() {
  const { t: translate } = useTranslation()
  const [tab, setTab] = useState<Tab>('shorten')

  // 4.4: each behavioural cluster is a self-contained custom hook.
  const shorten = useShortenForm({ t: translate })
  const statsView = useStatsView()
  const { totalVisits, mood } = useGlobalStats()
  const { stats, isLoading: statsLoading, error: statsQueryError } = useLinkStats(
    statsView.submittedStatsId,
    statsView.statsLimit,
  )
  const statsError = statsQueryError ? translate('home.statsForm.error') : stats?.error ?? null
  // 4.4: keep the StatsView prop compatible with its StatsData | null type.
  const statsViewData = (stats ?? null) as unknown as React.ComponentProps<typeof StatsView>['stats']

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
              onClick={() => { setTab(t); shorten.setError(null) }}
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
                url={shorten.url} onUrlChange={shorten.setUrl}
                customId={shorten.customId} onCustomIdChange={shorten.setCustomId}
                burnOnRead={shorten.burnOnRead} onBurnOnReadChange={shorten.setBurnOnRead}
                expiry={shorten.expiry} onExpiryChange={shorten.setExpiry}
                customExpiry={shorten.customExpiry} onCustomExpiryChange={shorten.setCustomExpiry}
                isLoading={shorten.isLoading} error={shorten.error}
                onSubmit={shorten.handleShorten}
              />
            </motion.div>
          ) : (
            <motion.div key="stats" role="tabpanel" id="panel-stats" aria-labelledby="tab-stats" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} style={{ padding: '1.75rem' }}>
              <StatsView
                statsId={statsView.statsId} onStatsIdChange={statsView.setStatsId}
                statsLoading={statsLoading} statsError={statsError}
                stats={statsViewData} onSubmit={statsView.handleViewStats}
                statsLimit={statsView.statsLimit} onStatsLimitChange={statsView.setStatsLimit}
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

      {shorten.shortUrl && (
        <ResultModal
          shortUrl={shorten.shortUrl} copySuccess={shorten.copySuccess}
          onCopy={shorten.handleCopy}
          onClose={shorten.closeResult}
        />
      )}
    </div>
  )
}
