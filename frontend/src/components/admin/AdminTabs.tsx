import type { AdminTab } from './types'

interface AdminTabsProps {
  tab: AdminTab
  setTab: (tab: AdminTab) => void
  selectedLinkForStats: string | null
  setSelectedLinkForStats: (id: string | null) => void
  fetchLinkStats: (linkId: string, limit?: number) => void
}

export default function AdminTabs({
  tab,
  setTab,
  selectedLinkForStats,
  setSelectedLinkForStats,
  fetchLinkStats,
}: AdminTabsProps) {
  return (
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
  )
}
