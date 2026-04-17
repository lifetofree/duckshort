import { motion } from 'motion/react'
import { useTranslation } from '../lib/i18n'
import type { StatsData } from '../types'

interface StatsViewProps {
  statsId: string
  onStatsIdChange: (v: string) => void
  statsLoading: boolean
  statsError: string | null
  stats: StatsData | null
  onSubmit: (e: React.FormEvent) => void
}

export function StatsView({ statsId, onStatsIdChange, statsLoading, statsError, stats, onSubmit }: StatsViewProps) {
  const { t: translate } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.65rem' }}>
        <input
          type="text"
          value={statsId}
          onChange={(e) => onStatsIdChange(e.target.value)}
          placeholder={translate('home.statsForm.placeholder')}
          required
          className="input-neon"
          style={{ flex: 1, padding: '1.05rem 1.25rem', borderRadius: '10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', letterSpacing: '1px' }}
        />
        <button
          type="submit"
          disabled={statsLoading || !statsId.trim()}
          className="btn-neon"
          style={{
            padding: '1.05rem 1.5rem', border: 'none', borderRadius: '10px', color: '#fff',
            fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '2px',
            cursor: statsLoading || !statsId.trim() ? 'not-allowed' : 'pointer',
            opacity: statsLoading || !statsId.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
          }}
        >
          {statsLoading ? '...' : translate('home.statsForm.button')}
        </button>
      </form>

      {statsError && (
        <p style={{ color: 'var(--error)', fontSize: '0.75rem', letterSpacing: '1px', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
          {statsError}
        </p>
      )}

      {stats && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.85rem 1.25rem', background: 'var(--bg-tertiary)', borderRadius: '10px',
            border: '1px solid rgba(0, 242, 255, 0.12)',
          }}>
            <span style={{ fontSize: '0.65rem', letterSpacing: '2px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
              {translate('home.stats.totalVisits')}
            </span>
            <span className="neon-glow-cyan" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.5rem', color: 'var(--neon-cyan)', fontWeight: 700 }}>
              {stats.visits}
            </span>
          </div>

          {stats.countries?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.6rem', letterSpacing: '2px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'JetBrains Mono, monospace' }}>
                {translate('home.stats.topCountries')}
              </p>
              {stats.countries.slice(0, 5).map((c) => (
                <div key={c.country} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{c.country}</span>
                  <span style={{ color: 'var(--neon-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>{c.count}</span>
                </div>
              ))}
            </div>
          )}

          {stats.referrers?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.6rem', letterSpacing: '2px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'JetBrains Mono, monospace' }}>
                {translate('home.stats.topReferrers')}
              </p>
              {stats.referrers.slice(0, 5).map((r) => (
                <div key={r.referer} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.75rem', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.referer}</span>
                  <span style={{ color: 'var(--neon-cyan)', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
