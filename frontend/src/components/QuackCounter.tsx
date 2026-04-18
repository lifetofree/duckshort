import { motion } from 'motion/react'
import { useTranslation } from '../lib/i18n'

const MILESTONES = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000, 10_000_000]

interface QuackCounterProps {
  totalVisits: number
}

export function QuackCounter({ totalVisits }: QuackCounterProps) {
  const { t: translate } = useTranslation()
  
  const hit = MILESTONES.find((m) => totalVisits >= m && totalVisits < m + 100) ?? null
  const displayCount = hit ?? totalVisits
  const isMilestone = hit !== null
  
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: isMilestone ? '0.82rem' : '0.65rem',
        letterSpacing: isMilestone ? '2px' : '3px',
        color: isMilestone ? 'var(--neon-magenta)' : 'var(--text-secondary)',
        textTransform: 'uppercase',
        marginTop: '0.75rem',
        marginBottom: 0,
        textShadow: isMilestone ? '0 0 12px var(--neon-magenta)' : 'none',
        fontWeight: isMilestone ? 700 : 400,
      }}
    >
      {translate('quackCounter.served', { count: displayCount.toLocaleString() })}
    </motion.p>
  )
}
