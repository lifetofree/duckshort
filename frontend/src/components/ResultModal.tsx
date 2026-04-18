import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from '../lib/i18n'

interface ResultModalProps {
  shortUrl: string
  copySuccess: boolean
  onCopy: () => void
  onClose: () => void
}

export function ResultModal({ shortUrl, copySuccess, onCopy, onClose }: ResultModalProps) {
  const { t: translate } = useTranslation()

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10, 12, 18, 0.92)',
        backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content glass-card-neon"
        style={{ padding: '2rem', width: '100%', maxWidth: '440px', borderRadius: '14px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '3px', color: 'var(--neon-cyan)', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
          {translate('home.modal.title')}
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '10px' }}>
            <QRCodeSVG value={shortUrl} size={130} level="M" />
          </div>
        </div>

        <p style={{ fontSize: '0.6rem', letterSpacing: '1px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'JetBrains Mono, monospace' }}>
          {translate('home.modal.yourShortUrl')}
        </p>
        <input
          type="text" readOnly value={shortUrl} className="input-neon"
          style={{ width: '100%', padding: '0.85rem 1.25rem', borderRadius: '10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', marginBottom: '0.85rem' }}
        />

        <button
          onClick={onCopy} className="btn-neon"
          style={{
            width: '100%', padding: '1rem', border: 'none', borderRadius: '10px', color: '#fff',
            fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '3px',
            textTransform: 'uppercase', cursor: 'pointer', marginBottom: '1.25rem', opacity: copySuccess ? 0.85 : 1,
          }}
        >
          {copySuccess ? translate('common.copied') : translate('home.modal.copyToClipboard')}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(0, 242, 255, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon-cyan)', boxShadow: '0 0 6px var(--neon-cyan)' }} />
            <span style={{ fontSize: '0.6rem', letterSpacing: '1px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
              {translate('home.modal.transferComplete')}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {translate('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
