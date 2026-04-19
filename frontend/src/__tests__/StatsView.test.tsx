/**
 * Isolated unit tests for the StatsView component.
 * Tests the form, error states, and stats display sections.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatsView } from '../components/StatsView'
import { renderWithProviders } from '../test/renderWithProviders'
import type { StatsData } from '../types'

const SAMPLE_STATS: StatsData = {
  link: {
    id: 'abc12345',
    original_url: 'https://example.com',
    created_at: '2026-04-01T00:00:00.000Z',
    expires_at: null,
    disabled: 0,
    tag: null,
  },
  visits: 42,
  countries: [
    { country: 'US', count: 30 },
    { country: 'GB', count: 8 },
    { country: 'DE', count: 4 },
  ],
  referrers: [
    { referer: 'https://google.com', count: 25 },
    { referer: 'direct', count: 17 },
  ],
}

function defaultProps(overrides: Partial<Parameters<typeof StatsView>[0]> = {}) {
  return {
    statsId: '',
    onStatsIdChange: vi.fn(),
    statsLoading: false,
    statsError: null,
    stats: null,
    onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    ...overrides,
  }
}

describe('StatsView — rendering', () => {
  it('renders the stats ID input', () => {
    renderWithProviders(<StatsView {...defaultProps()} />)
    expect(screen.getByPlaceholderText(/enter link id/i)).toBeInTheDocument()
  })

  it('renders the lookup button', () => {
    renderWithProviders(<StatsView {...defaultProps()} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('disables the button when statsId is empty', () => {
    renderWithProviders(<StatsView {...defaultProps({ statsId: '' })} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('enables the button when statsId is non-empty', () => {
    renderWithProviders(<StatsView {...defaultProps({ statsId: 'abc12345' })} />)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('shows "..." in button while loading', () => {
    renderWithProviders(<StatsView {...defaultProps({ statsId: 'abc', statsLoading: true })} />)
    expect(screen.getByRole('button').textContent).toBe('...')
  })

  it('disables button while loading', () => {
    renderWithProviders(<StatsView {...defaultProps({ statsId: 'abc', statsLoading: true })} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('StatsView — error state', () => {
  it('displays error message when statsError is set', () => {
    renderWithProviders(<StatsView {...defaultProps({ statsError: 'Link not found' })} />)
    expect(screen.getByText('Link not found')).toBeInTheDocument()
  })

  it('does not display error when statsError is null', () => {
    renderWithProviders(<StatsView {...defaultProps({ statsError: null })} />)
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument()
  })
})

describe('StatsView — stats display', () => {
  it('shows visit count when stats are provided', () => {
    renderWithProviders(<StatsView {...defaultProps({ stats: SAMPLE_STATS })} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows top countries section', () => {
    renderWithProviders(<StatsView {...defaultProps({ stats: SAMPLE_STATS })} />)
    expect(screen.getByText(/top countries/i)).toBeInTheDocument()
    expect(screen.getByText('US')).toBeInTheDocument()
    expect(screen.getByText('GB')).toBeInTheDocument()
  })

  it('shows top referrers section', () => {
    renderWithProviders(<StatsView {...defaultProps({ stats: SAMPLE_STATS })} />)
    expect(screen.getByText(/top referrers/i)).toBeInTheDocument()
    expect(screen.getByText('https://google.com')).toBeInTheDocument()
    expect(screen.getByText('direct')).toBeInTheDocument()
  })

  it('does not show countries section when countries array is empty', () => {
    const statsWithNoCountries: StatsData = { ...SAMPLE_STATS, countries: [] }
    renderWithProviders(<StatsView {...defaultProps({ stats: statsWithNoCountries })} />)
    expect(screen.queryByText(/top countries/i)).not.toBeInTheDocument()
  })

  it('does not show referrers section when referrers array is empty', () => {
    const statsWithNoReferrers: StatsData = { ...SAMPLE_STATS, referrers: [] }
    renderWithProviders(<StatsView {...defaultProps({ stats: statsWithNoReferrers })} />)
    expect(screen.queryByText(/top referrers/i)).not.toBeInTheDocument()
  })

  it('shows nothing when stats is null', () => {
    renderWithProviders(<StatsView {...defaultProps({ stats: null })} />)
    expect(screen.queryByText(/total visits/i)).not.toBeInTheDocument()
  })

  it('shows country visit counts', () => {
    renderWithProviders(<StatsView {...defaultProps({ stats: SAMPLE_STATS })} />)
    expect(screen.getByText('30')).toBeInTheDocument() // US count
    expect(screen.getByText('8')).toBeInTheDocument()  // GB count
  })

  it('limits displayed countries to 5', () => {
    const manyCountries: StatsData = {
      ...SAMPLE_STATS,
      countries: Array.from({ length: 10 }, (_, i) => ({ country: `C${i}`, count: 10 - i })),
    }
    renderWithProviders(<StatsView {...defaultProps({ stats: manyCountries })} />)
    // Only first 5 should appear (StatsView slices to 5)
    expect(screen.getByText('C0')).toBeInTheDocument()
    expect(screen.getByText('C4')).toBeInTheDocument()
    expect(screen.queryByText('C5')).not.toBeInTheDocument()
  })
})

describe('StatsView — form interactions', () => {
  it('calls onStatsIdChange when typing', async () => {
    const onStatsIdChange = vi.fn()
    renderWithProviders(<StatsView {...defaultProps({ onStatsIdChange })} />)
    const input = screen.getByPlaceholderText(/enter link id/i)
    await userEvent.type(input, 'a')
    expect(onStatsIdChange).toHaveBeenCalled()
  })

  it('calls onSubmit when form is submitted', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    renderWithProviders(<StatsView {...defaultProps({ statsId: 'abc', onSubmit })} />)
    const btn = screen.getByRole('button')
    await userEvent.click(btn)
    expect(onSubmit).toHaveBeenCalled()
  })

  it('reflects the current statsId in input value', () => {
    renderWithProviders(<StatsView {...defaultProps({ statsId: 'my-link-id' })} />)
    const input = screen.getByPlaceholderText(/enter link id/i) as HTMLInputElement
    expect(input.value).toBe('my-link-id')
  })
})
