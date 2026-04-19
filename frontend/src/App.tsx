import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/Home'
import AdminPage from './pages/Admin'
import DevModeBar from './components/DevModeBar'

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
      paddingTop: import.meta.env.MODE === 'development' ? '5rem' : '0',
    }}>
      <span style={{ fontSize: '3rem', fontFamily: 'Orbitron, sans-serif', color: 'var(--neon-cyan)', textShadow: '0 0 10px var(--neon-cyan)' }}>404</span>
      <span className="neon-glow-cyan">PAGE NOT FOUND</span>
    </div>
  )
}

export default function App() {
  return (
    <>
      <DevModeBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/management/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
