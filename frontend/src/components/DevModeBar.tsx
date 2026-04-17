import { useTranslation } from '../lib/i18n'

export default function DevModeBar() {
  const { t: translate } = useTranslation()
  
  if (import.meta.env.MODE !== 'development') {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '36px',
        background: 'rgba(255, 0, 85, 0.15)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255, 0, 85, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        zIndex: 9999,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.65rem',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        color: '#ff80ab',
        textShadow: '0 0 6px rgba(255, 0, 85, 0.5)',
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#ff0055',
          boxShadow: '0 0 8px #ff0055, 0 0 16px rgba(255, 0, 85, 0.6)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <span>{translate('devModeBar.text')}</span>
    </div>
  )
}
