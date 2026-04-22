import { motion } from 'motion/react'
import { useTranslation } from '../lib/i18n'
import type { StatsData } from '../types'
import { NeonHeatmap } from './NeonHeatmap'

interface StatsViewProps {
  statsId: string
  onStatsIdChange: (v: string) => void
  statsLoading: boolean
  statsError: string | null
  stats: StatsData | null
  onSubmit: (e: React.FormEvent) => void
  statsLimit?: number
  onStatsLimitChange?: (v: number) => void
}

const LIMIT_OPTIONS = [
  { label: 'Top 5', value: 5 },
  { label: 'Top 10', value: 10 },
  { label: 'Top 25', value: 25 },
  { label: 'Top 50', value: 50 },
  { label: 'Top 100', value: 100 },
]

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '40px' }}>
      {data.map((val, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max((val / max) * 100, 4)}%`,
            background: i === data.length - 1 ? 'var(--neon-magenta)' : 'var(--neon-cyan)',
            borderRadius: '2px 2px 0 0',
            opacity: val === 0 ? 0.3 : 0.8,
            transition: 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

export function StatsView({ statsId, onStatsIdChange, statsLoading, statsError, stats, onSubmit, statsLimit = 10, onStatsLimitChange }: StatsViewProps) {
  const { t: translate } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <input
            type="text"
            value={statsId}
            onChange={(e) => onStatsIdChange(e.target.value)}
            placeholder={translate('home.statsForm.placeholder')}
            required
            className="input-neon"
            style={{ flex: 1, padding: '1.05rem 1.25rem', borderRadius: '10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', letterSpacing: '1px' }}
          />
          {onStatsLimitChange && (
            <select
              value={statsLimit}
              onChange={(e) => onStatsLimitChange(Number(e.target.value))}
              className="input-neon"
              style={{
                padding: '1.05rem 1rem', borderRadius: '10px', fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.7rem', letterSpacing: '1px', color: 'var(--neon-cyan)', minWidth: '100px',
                background: 'var(--bg-tertiary)', border: '1px solid rgba(0, 242, 255, 0.2)',
              }}
            >
              {LIMIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
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
        </div>
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

          {stats.sparkline && stats.sparkline.length > 0 && (
            <div style={{
              padding: '0.85rem 1.25rem', background: 'var(--bg-tertiary)', borderRadius: '10px',
              border: '1px solid rgba(0, 242, 255, 0.12)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.6rem', letterSpacing: '2px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                  7-DAY ACTIVITY
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {stats.sparkline.reduce((a, b) => a + b, 0)} total
                </span>
              </div>
              <Sparkline data={stats.sparkline} />
            </div>
          )}

          {stats.countries && stats.countries.length > 0 && (
            <NeonHeatmap countries={stats.countries} />
          )}

          {stats.countries?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.6rem', letterSpacing: '2px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'JetBrains Mono, monospace' }}>
                {translate('home.stats.topCountries')} ({statsLimit})
              </p>
              {stats.countries.slice(0, statsLimit).map((c) => (
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
                {translate('home.stats.topReferrers')} ({statsLimit})
              </p>
              {stats.referrers.slice(0, statsLimit).map((r) => (
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
