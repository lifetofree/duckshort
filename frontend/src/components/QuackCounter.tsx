import { motion } from 'motion/react'

const MILESTONES = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000, 10_000_000]

function getQuackDisplay(count: number): { text: string; isMilestone: boolean } {
  const hit = MILESTONES.find((m) => count >= m && count < m + 100) ?? null
  const displayCount = hit ?? count
  return { text: `🦆 ${displayCount.toLocaleString()} QUACKS SERVED`, isMilestone: hit !== null }
}

interface QuackCounterProps {
  totalVisits: number
}

export function QuackCounter({ totalVisits }: QuackCounterProps) {
  const { text, isMilestone } = getQuackDisplay(totalVisits)
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
      {text}
    </motion.p>
  )
}
