import { motion } from 'motion/react'
import { useTranslation } from '../lib/i18n'
import logo from '../assets/logo.png'

export type DuckMood = 'DORMANT' | 'ACTIVE' | 'BUSY' | 'VIRAL' | 'ERROR'

interface DuckMoodLogoProps {
  mood: DuckMood
}

const MOOD_CONFIG: Record<
  DuckMood,
  {
    key: string
    labelColor: string
    dotColor: string
    borderColor: string
    glow: string
    filter?: string
    badge?: string
    pulse?: boolean
  }
> = {
  DORMANT: {
    key: 'duckMood.dormant',
    labelColor: 'var(--text-secondary)',
    dotColor: '#4a4a5e',
    borderColor: 'rgba(100, 100, 140, 0.35)',
    glow: '0 0 10px rgba(100, 100, 140, 0.2)',
  },
  ACTIVE: {
    key: 'duckMood.active',
    labelColor: 'var(--neon-cyan)',
    dotColor: 'var(--neon-cyan)',
    borderColor: 'rgba(0, 242, 255, 0.45)',
    glow: '0 0 18px rgba(0, 242, 255, 0.4), 0 0 50px rgba(0, 242, 255, 0.15)',
  },
  BUSY: {
    key: 'duckMood.busy',
    labelColor: '#f5c518',
    dotColor: '#f5c518',
    borderColor: 'rgba(245, 197, 24, 0.55)',
    glow: '0 0 18px rgba(245, 197, 24, 0.45), 0 0 50px rgba(245, 197, 24, 0.18)',
    badge: '😎',
  },
  VIRAL: {
    key: 'duckMood.viral',
    labelColor: 'var(--neon-magenta)',
    dotColor: 'var(--neon-magenta)',
    borderColor: 'rgba(255, 0, 255, 0.6)',
    glow: '0 0 22px rgba(255, 0, 255, 0.55), 0 0 60px rgba(255, 0, 255, 0.22)',
    badge: '😎',
    pulse: true,
  },
  ERROR: {
    key: 'duckMood.degraded',
    labelColor: 'var(--error)',
    dotColor: 'var(--error)',
    borderColor: 'rgba(255, 60, 80, 0.45)',
    glow: '0 0 14px rgba(255, 60, 80, 0.35)',
    filter: 'grayscale(70%) brightness(0.75)',
    badge: '😢',
  },
}

export default function DuckMoodLogo({ mood }: DuckMoodLogoProps) {
  const { t: translate } = useTranslation()
  const cfg = MOOD_CONFIG[mood]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
      {/* Logo + badge wrapper */}
      <motion.div
        style={{ position: 'relative', display: 'inline-block' }}
        animate={cfg.pulse ? { scale: [1, 1.03, 1] } : { scale: 1 }}
        transition={cfg.pulse ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        <img
          src={logo}
          alt="DuckShort"
          style={{
            display: 'block',
            width: '140px',
            height: '140px',
            objectFit: 'cover',
            borderRadius: '50%',
            border: `3px solid ${cfg.borderColor}`,
            boxShadow: cfg.glow,
            filter: cfg.filter,
            transition: 'border-color 0.6s ease, box-shadow 0.6s ease, filter 0.6s ease',
          }}
        />

        {/* Badge emoji */}
        {cfg.badge && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              fontSize: '1.75rem',
              lineHeight: 1,
              filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))',
              pointerEvents: 'none',
            }}
          >
            {cfg.badge}
          </motion.span>
        )}
      </motion.div>

      {/* Mood status pill */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 10px',
          borderRadius: '999px',
          border: `1px solid ${cfg.borderColor}`,
          background: 'rgba(10, 10, 20, 0.6)',
        }}
      >
        <motion.span
          animate={cfg.pulse ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
          transition={cfg.pulse ? { duration: 1.2, repeat: Infinity } : undefined}
          style={{
            display: 'block',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: cfg.dotColor,
            boxShadow: `0 0 5px ${cfg.dotColor}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.58rem',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: cfg.labelColor,
            fontWeight: 600,
          }}
        >
          {translate(cfg.key)}
        </span>
      </motion.div>
    </div>
  )
}
