/** @jsxImportSource hono/jsx */
import Layout from '../Layout'

interface NotFoundProps {
  message?: string
}

export default function NotFound({ message = 'PAGE NOT FOUND' }: NotFoundProps) {
  return (
    <Layout title="404 | DuckShort">
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '1.5rem',
        padding: '2rem'
      }}>
        <h1 style={{
          fontSize: 'clamp(5rem, 15vw, 8rem)',
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 900,
          color: 'var(--neon-magenta)',
          textShadow: '0 0 30px var(--neon-magenta)',
          margin: 0,
          lineHeight: 1
        }}>404</h1>
        
        <div class="glass-card" style={{
          padding: '1.5rem 3rem',
          borderRadius: '12px',
          border: '1px solid rgba(0, 242, 255, 0.2)',
          boxShadow: '0 0 20px rgba(0, 242, 255, 0.05)'
        }}>
          <p style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '1rem',
            letterSpacing: '4px',
            color: 'var(--neon-cyan)',
            textTransform: 'uppercase',
            margin: 0,
            textShadow: '0 0 8px var(--neon-cyan)'
          }}>{message}</p>
        </div>

        <a href="/" style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.75rem',
          letterSpacing: '2px',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          textTransform: 'uppercase',
          marginTop: '2rem',
          borderBottom: '1px solid transparent',
          transition: 'all 0.2s'
        }} onmouseover="this.style.color='var(--neon-cyan)'; this.style.borderBottom='1px solid var(--neon-cyan)'" 
           onmouseout="this.style.color='var(--text-secondary)'; this.style.borderBottom='1px solid transparent'">
          ↩ RETURN_TO_POND
        </a>
      </div>
    </Layout>
  )
}