import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/Home'

function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      color: 'var(--text-secondary)',
      fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: '2px',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      gap: '0.5rem',
    }}>
      <span style={{ fontSize: '3rem', fontFamily: 'Orbitron, sans-serif', color: 'var(--neon-cyan)' }}>404</span>
      <span>PAGE NOT FOUND</span>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
