import { useTranslation } from '../lib/i18n'

interface ShortenFormProps {
  url: string
  onUrlChange: (v: string) => void
  customId: string
  onCustomIdChange: (v: string) => void
  burnOnRead: boolean
  onBurnOnReadChange: (v: boolean) => void
  expiry: number
  onExpiryChange: (v: number) => void
  customExpiry: string
  onCustomExpiryChange: (v: string) => void
  isLoading: boolean
  error: string | null
  onSubmit: (e: React.FormEvent) => void
}

export function ShortenForm({
  url, onUrlChange,
  customId, onCustomIdChange,
  burnOnRead, onBurnOnReadChange,
  expiry, onExpiryChange,
  customExpiry, onCustomExpiryChange,
  isLoading, error, onSubmit,
}: ShortenFormProps) {
  const { t: translate } = useTranslation()

  const EXPIRY_OPTIONS = [
    { label: translate('home.shortenForm.expiryOptions.never'), value: 0 },
    { label: translate('home.shortenForm.expiryOptions.1hour'), value: 3600 },
    { label: translate('home.shortenForm.expiryOptions.24hours'), value: 86400 },
    { label: translate('home.shortenForm.expiryOptions.7days'), value: 604800 },
    { label: translate('home.shortenForm.expiryOptions.30days'), value: 2592000 },
    { label: translate('home.shortenForm.expiryOptions.custom'), value: -1 },
  ]

  const isCustomExpiry = expiry === -1

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <input
        type="url"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder={translate('home.shortenForm.urlPlaceholder')}
        disabled={isLoading}
        required
        className="input-neon"
        style={{
          width: '100%',
          padding: '1.05rem 1.25rem',
          borderRadius: '10px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.78rem',
          letterSpacing: '1px',
        }}
      />

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            value={customId}
            onChange={(e) => onCustomIdChange(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            placeholder={translate('home.shortenForm.customAliasPlaceholder')}
            disabled={isLoading}
            className="input-neon"
            style={{
              width: '100%',
              padding: '1.05rem 1.25rem',
              borderRadius: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              letterSpacing: '1px',
            }}
          />
        </div>

        <div
          className="input-neon"
          style={{
            flex: 1,
            minWidth: '200px',
            display: 'flex',
            alignItems: 'center',
            padding: '0.9rem 1.25rem',
            borderRadius: '10px',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              fontSize: '0.6rem',
              letterSpacing: '2px',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              flexShrink: 0,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {translate('home.shortenForm.expiry')}
          </span>
          <select
            value={expiry}
            onChange={(e) => onExpiryChange(Number(e.target.value))}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--neon-cyan)',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              fontSize: '0.7rem',
              letterSpacing: '1px',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              textTransform: 'uppercase',
            }}
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ background: 'var(--bg-tertiary)', color: 'var(--neon-cyan)' }}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isCustomExpiry && (
        <input
          type="number"
          min="1"
          value={customExpiry}
          onChange={(e) => onCustomExpiryChange(e.target.value)}
          placeholder={translate('home.shortenForm.customExpiryPlaceholder')}
          disabled={isLoading}
          className="input-neon"
          style={{
            width: '100%',
            padding: '1.05rem 1.25rem',
            borderRadius: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.78rem',
            letterSpacing: '1px',
          }}
        />
      )}

      {/* Burn on Read Toggle */}
      <div
        onClick={() => onBurnOnReadChange(!burnOnRead)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.25rem' }}
      >
        <div style={{
          width: '38px', height: '20px', borderRadius: '20px',
          background: burnOnRead ? 'var(--neon-magenta)' : 'var(--bg-tertiary)',
          border: `1px solid ${burnOnRead ? 'var(--neon-magenta)' : 'rgba(0, 242, 255, 0.2)'}`,
          position: 'relative', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: burnOnRead ? '0 0 8px var(--neon-magenta)' : 'none',
        }}>
          <div style={{
            width: '14px', height: '14px', borderRadius: '50%',
            background: burnOnRead ? '#fff' : 'var(--text-secondary)',
            position: 'absolute', top: '2px',
            left: burnOnRead ? '20px' : '2px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
          letterSpacing: '2px',
          color: burnOnRead ? 'var(--neon-magenta)' : 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}>
          {translate('home.shortenForm.burnOnRead')}
        </span>
      </div>

      {error && (
        <p style={{ color: 'var(--error)', fontSize: '0.75rem', letterSpacing: '1px', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading || !url.trim()}
        className="btn-neon"
        style={{
          width: '100%', padding: '1.15rem', border: 'none', borderRadius: '10px',
          color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
          fontSize: '1.05rem', letterSpacing: '5px', textTransform: 'uppercase',
          cursor: isLoading || !url.trim() ? 'not-allowed' : 'pointer',
          opacity: isLoading || !url.trim() ? 0.5 : 1,
        }}
      >
        {isLoading ? translate('common.loading') : translate('home.shortenForm.button')}
      </button>
    </form>
  )
}
