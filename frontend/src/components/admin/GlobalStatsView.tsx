import { motion } from 'motion/react'
import type { GlobalStats, Link } from './types'

interface GlobalStatsViewProps {
  globalStats: GlobalStats
  topLinks: Link[]
  onSelectLink: (linkId: string) => void
}

export default function GlobalStatsView({ globalStats, topLinks, onSelectLink }: GlobalStatsViewProps) {
  return (
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
          {topLinks
            .map((link) => {
              const totalVisits = link.sparkline.reduce((sum, val) => sum + val, 0)
              return (
                <div
                  key={link.id}
                  onClick={() => onSelectLink(link.id)}
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
                    {link.sparkline.map((val, i) => {
                      const peak = Math.max(...link.sparkline, 1)
                      return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          background: `rgba(0, 242, 255, ${0.3 + (val / peak) * 0.7})`,
                          height: `${(val / peak) * 100}%`,
                          borderRadius: '2px',
                          minWidth: '2px',
                        }}
                      />
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </motion.div>
  )
}
