/**
 * 2.2: First-paint skeleton for the Admin Links tab.
 *
 * Renders a stylised placeholder grid that mirrors the LinkTable layout
 * (id / url / status / tag / visits / actions rows) so the user sees a
 * coherent shell before the lazy chunk + DB query resolve. Uses
 * neon-themed shimmer animation to stay on-brand.
 */
const ROWS = 6

function SkeletonRow({ index }: { index: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr 100px 120px 80px 140px',
        gap: '1rem',
        padding: '0.85rem 1.5rem',
        borderBottom: '1px solid rgba(0, 242, 255, 0.05)',
        opacity: 1 - index * 0.08,
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    >
      <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(0, 242, 255, 0.08)' }} />
      <div style={{ height: 12, borderRadius: 4, background: 'rgba(0, 242, 255, 0.08)' }} />
      <div style={{ height: 12, borderRadius: 4, background: 'rgba(255, 0, 85, 0.08)' }} />
      <div style={{ height: 12, borderRadius: 4, background: 'rgba(191, 0, 255, 0.08)' }} />
      <div style={{ height: 12, borderRadius: 4, background: 'rgba(0, 242, 255, 0.08)' }} />
      <div style={{ height: 12, borderRadius: 4, background: 'rgba(255, 0, 85, 0.08)' }} />
    </div>
  )
}

export default function LinkTableSkeleton() {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid rgba(0, 242, 255, 0.1)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 100px 120px 80px 140px',
          gap: '1rem',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid rgba(0, 242, 255, 0.15)',
          background: 'rgba(0, 242, 255, 0.04)',
        }}
      >
        {['CHECK', 'URL', 'STATUS', 'TAG', 'VISITS', 'ACTIONS'].map((h) => (
          <div
            key={h}
            style={{
              fontSize: '0.6rem',
              letterSpacing: '2px',
              color: 'var(--text-secondary)',
              fontWeight: 700,
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {Array.from({ length: ROWS }).map((_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
      <div
        style={{
          padding: '1rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          letterSpacing: '2px',
        }}
      >
        FETCHING LINKS…
      </div>
    </div>
  )
}
