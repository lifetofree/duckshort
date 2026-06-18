import { useState } from 'react'

const API = import.meta.env.VITE_API_URL ?? ''

interface AdminAuthGateProps {
  onAuthenticated: () => void
}

export default function AdminAuthGate({ onAuthenticated }: AdminAuthGateProps) {
  const [loginInput, setLoginInput] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setLoginError(null)
    try {
      const res = await fetch(`${API}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: loginInput }),
      })
      if (res.ok) {
        setLoginInput('')
        onAuthenticated()
      } else {
        const data = await res.json()
        setLoginError(data.error ?? 'Invalid credentials')
      }
    } catch {
      setLoginError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.5rem', color: 'var(--neon-cyan)', marginBottom: '0.5rem' }}>
          ADMIN ACCESS
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '2px' }}>
          ENTER THE NEON POND CONTROL CENTER
        </p>
      </div>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            Admin Secret
          </label>
          <input
            type="password"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            placeholder="Enter admin secret"
            required
            autoFocus
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid rgba(0, 242, 255, 0.2)',
              color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.75rem',
              borderRadius: '8px',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--neon-cyan)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(0, 242, 255, 0.2)'}
          />
        </div>
        {loginError && (
          <div style={{ background: 'rgba(255, 0, 85, 0.1)', border: '1px solid var(--neon-magenta)', padding: '0.75rem', borderRadius: '8px', color: 'var(--neon-magenta)', fontSize: '0.7rem' }}>
            {loginError}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.85rem',
            background: loading ? 'var(--bg-tertiary)' : 'var(--neon-cyan)',
            border: 'none',
            color: loading ? 'var(--text-secondary)' : '#000',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 700,
            fontSize: '0.85rem',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            borderRadius: '8px',
            transition: 'all 0.2s',
            opacity: loading ? 0.5 : 1,
          }}
          onMouseOver={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 242, 255, 0.5)' }}
          onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
        >
          {loading ? 'ENTERING...' : 'ENTER'}
        </button>
      </form>
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.7rem', letterSpacing: '1px' }}>
          ← BACK TO HOME
        </a>
      </div>
    </div>
  )
}
