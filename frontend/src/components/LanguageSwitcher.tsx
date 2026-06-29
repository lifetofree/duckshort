import { useTranslation, Locale } from '../lib/i18n'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        gap: '0.25rem',
        background: 'var(--bg-secondary)',
        padding: '0.25rem',
        borderRadius: '20px',
        border: '1px solid rgba(0, 242, 255, 0.15)',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
        zIndex: 10,
      }}
    >
      {(['en', 'th'] as const).map((lang) => {
        const isActive = locale === lang
        return (
          <button
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            style={{
              padding: '0.35rem 0.75rem',
              border: 'none',
              borderRadius: '16px',
              background: isActive ? 'rgba(0, 242, 255, 0.1)' : 'transparent',
              color: isActive ? 'var(--neon-cyan)' : 'var(--text-secondary)',
              fontFamily: 'Orbitron, JetBrains Mono, monospace',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: 'pointer',
              boxShadow: isActive ? '0 0 8px rgba(0, 242, 255, 0.3)' : 'none',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: isActive ? 'var(--neon-cyan)' : 'transparent',
              transition: 'all 0.2s ease-in-out',
            }}
          >
            {lang === 'en' ? 'EN' : 'TH'}
          </button>
        )
      })}
    </div>
  )
}
