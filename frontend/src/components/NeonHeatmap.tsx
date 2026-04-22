interface CountryStat {
  country: string
  count: number
}

interface NeonHeatmapProps {
  countries: CountryStat[]
}

function getNeonColor(intensity: number): { bg: string; glow: string } {
  // intensity: 0-1 where 1 = highest
  // cyan (low) = #00F2FF, magenta (high) = #FF0055
  const cyan = { r: 0, g: 242, b: 255 }
  const magenta = { r: 255, g: 0, b: 85 }
  const t = intensity
  const r = Math.round(cyan.r + (magenta.r - cyan.r) * t)
  const g = Math.round(cyan.g + (magenta.g - cyan.g) * t)
  const b = Math.round(cyan.b + (magenta.b - cyan.b) * t)
  const glowIntensity = 0.2 + intensity * 0.6
  return {
    bg: `rgba(${r}, ${g}, ${b}, ${0.08 + intensity * 0.2})`,
    glow: `0 0 ${Math.round(8 + intensity * 16)}px rgba(${r}, ${g}, ${b}, ${glowIntensity})`,
  }
}

export function NeonHeatmap({ countries }: NeonHeatmapProps) {
  if (!countries || countries.length === 0) return null

  const max = Math.max(...countries.map((c) => c.count))
  const total = countries.reduce((sum, c) => sum + c.count, 0)

  return (
    <div style={{
      padding: '0.85rem 1.25rem',
      background: 'var(--bg-tertiary)',
      borderRadius: '10px',
      border: '1px solid rgba(0, 242, 255, 0.12)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
      }}>
        <span style={{
          fontSize: '0.6rem',
          letterSpacing: '2px',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          NEON HEATMAP
        </span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
          {countries.length} countries
        </span>
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginBottom: '0.75rem',
      }}>
        {countries.slice(0, 20).map((c) => {
          const intensity = max > 0 ? c.count / max : 0
          const { bg, glow } = getNeonColor(intensity)
          return (
            <div
              key={c.country}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 10px',
                background: bg,
                borderRadius: '6px',
                boxShadow: glow,
                border: `1px solid rgba(${intensity > 0.5 ? '255,0,85' : '0,242,255'}, ${0.15 + intensity * 0.35})`,
                minWidth: '52px',
                cursor: 'default',
                transition: 'box-shadow 0.3s ease',
              }}
              title={`${c.country}: ${c.count} visits (${max > 0 ? ((c.count / total) * 100).toFixed(1) : 0}%)`}
            >
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem',
                fontWeight: 700,
                color: intensity > 0.5 ? 'var(--neon-magenta)' : 'var(--neon-cyan)',
                letterSpacing: '1px',
              }}>
                {c.country}
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.55rem',
                color: 'var(--text-secondary)',
                marginTop: '2px',
              }}>
                {c.count}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.55rem', color: 'var(--neon-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>LOW</span>
        <div style={{
          flex: 1,
          height: '4px',
          borderRadius: '2px',
          background: 'linear-gradient(to right, var(--neon-cyan), var(--neon-purple), var(--neon-magenta))',
          opacity: 0.6,
        }} />
        <span style={{ fontSize: '0.55rem', color: 'var(--neon-magenta)', fontFamily: 'JetBrains Mono, monospace' }}>HIGH</span>
      </div>
    </div>
  )
}
