import { motion } from 'motion/react'
import type { LinkStats, Link } from './types'

interface PerLinkStatsViewProps {
  selectedLinkForStats: string
  linkStats: LinkStats
  allLinks: Link[]
  statsLimit: number
  setStatsLimit: (limit: number) => void
  fetchLinkStats: (linkId: string, limit?: number) => void
  onBack: () => void
}

export default function PerLinkStatsView({
  selectedLinkForStats,
  linkStats,
  allLinks,
  statsLimit,
  setStatsLimit,
  fetchLinkStats,
  onBack,
}: PerLinkStatsViewProps) {
  return (
    <motion.div key="link-stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={onBack}
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
              {allLinks.find(l => l.id === selectedLinkForStats)?.original_url}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '1px' }}>LIMIT:</label>
            <select
              value={statsLimit}
              onChange={(e) => {
                const newLimit = Number(e.target.value)
                setStatsLimit(newLimit)
                fetchLinkStats(selectedLinkForStats!, newLimit)
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
  )
}
