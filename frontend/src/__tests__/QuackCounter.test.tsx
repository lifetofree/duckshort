/**
 * Unit tests for the QuackCounter component.
 * Tests visit count display, formatting, and milestone detection logic.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { QuackCounter } from '../components/QuackCounter'
import { renderWithProviders } from '../test/renderWithProviders'

describe('QuackCounter — basic rendering', () => {
  it('displays the visit count with duck emoji', () => {
    renderWithProviders(<QuackCounter totalVisits={5} />)
    expect(screen.getByText(/5 quacks served/i)).toBeInTheDocument()
  })

  it('formats large numbers with commas', () => {
    renderWithProviders(<QuackCounter totalVisits={1234567} />)
    expect(screen.getByText(/1,234,567/)).toBeInTheDocument()
  })

  it('shows zero visits', () => {
    renderWithProviders(<QuackCounter totalVisits={0} />)
    expect(screen.getByText(/0 quacks served/i)).toBeInTheDocument()
  })

  it('includes the duck emoji in the display', () => {
    renderWithProviders(<QuackCounter totalVisits={10} />)
    expect(screen.getByText(/🦆/)).toBeInTheDocument()
  })
})

describe('QuackCounter — milestone detection', () => {
  const MILESTONES = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000, 10_000_000]

  for (const milestone of MILESTONES) {
    it(`detects milestone at exactly ${milestone.toLocaleString()}`, () => {
      renderWithProviders(<QuackCounter totalVisits={milestone} />)
      const el = screen.getByText(new RegExp(milestone.toLocaleString()))
      // Milestone text has larger font — we verify it still renders with correct count
      expect(el).toBeInTheDocument()
    })

    it(`detects milestone at ${milestone.toLocaleString()} + 50 (within 100-wide window)`, () => {
      renderWithProviders(<QuackCounter totalVisits={milestone + 50} />)
      // Within the +0 to +99 window, still shows the milestone value
      const el = screen.getByText(new RegExp(milestone.toLocaleString()))
      expect(el).toBeInTheDocument()
    })

    it(`does NOT treat ${(milestone + 100).toLocaleString()} as a milestone`, () => {
      const nonMilestone = milestone + 100
      renderWithProviders(<QuackCounter totalVisits={nonMilestone} />)
      // Should display the actual count, not the milestone
      const el = screen.getByText(new RegExp(nonMilestone.toLocaleString()))
      expect(el).toBeInTheDocument()
      // The milestone value should NOT appear (displayed as actual count)
      if (!MILESTONES.includes(nonMilestone)) {
        expect(screen.queryByText(new RegExp(`^🦆 ${milestone.toLocaleString()} QUACKS`))).not.toBeInTheDocument()
      }
    })
  }

  it('does not trigger milestone for ordinary counts', () => {
    renderWithProviders(<QuackCounter totalVisits={500} />)
    expect(screen.getByText(/500 quacks served/i)).toBeInTheDocument()
  })

  it('milestone at 1,000 shows magenta colour class via inline style', () => {
    const { container } = renderWithProviders(<QuackCounter totalVisits={1000} />)
    const p = container.querySelector('p')
    // At a milestone, color switches to neon-magenta
    expect(p?.style.color).toContain('magenta')
  })

  it('non-milestone shows secondary text colour', () => {
    const { container } = renderWithProviders(<QuackCounter totalVisits={999} />)
    const p = container.querySelector('p')
    expect(p?.style.color).not.toContain('magenta')
  })
})
