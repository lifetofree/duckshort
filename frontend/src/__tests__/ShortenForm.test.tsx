/**
 * Isolated unit tests for the ShortenForm component.
 * Tests input validation, UI state, and prop-driven behavior.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShortenForm } from '../components/ShortenForm'
import { renderWithProviders } from '../test/renderWithProviders'

function defaultProps(overrides: Partial<Parameters<typeof ShortenForm>[0]> = {}) {
  return {
    url: '',
    onUrlChange: vi.fn(),
    customId: '',
    onCustomIdChange: vi.fn(),
    burnOnRead: false,
    onBurnOnReadChange: vi.fn(),
    expiry: 0,
    onExpiryChange: vi.fn(),
    customExpiry: '',
    onCustomExpiryChange: vi.fn(),
    isLoading: false,
    error: null,
    onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    ...overrides,
  }
}

describe('ShortenForm — rendering', () => {
  it('renders URL input and shorten button', () => {
    renderWithProviders(<ShortenForm {...defaultProps()} />)
    expect(screen.getByPlaceholderText(/paste your long url here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /shorten/i })).toBeInTheDocument()
  })

  it('renders custom alias input', () => {
    renderWithProviders(<ShortenForm {...defaultProps()} />)
    expect(screen.getByPlaceholderText(/custom_alias/i)).toBeInTheDocument()
  })

  it('renders expiry dropdown', () => {
    renderWithProviders(<ShortenForm {...defaultProps()} />)
    const select = document.querySelector('select')
    expect(select).toBeInTheDocument()
  })

  it('renders burn-on-read toggle', () => {
    renderWithProviders(<ShortenForm {...defaultProps()} />)
    expect(screen.getByText(/burn_on_read/i)).toBeInTheDocument()
  })

  it('displays error message when error prop is set', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ error: 'Something went wrong' })} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('does not display error when error prop is null', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ error: null })} />)
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })
})

describe('ShortenForm — submit button state', () => {
  it('disables button when URL is empty', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ url: '' })} />)
    const btn = screen.getByRole('button', { name: /shorten/i })
    expect(btn).toBeDisabled()
  })

  it('enables button when URL is provided', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ url: 'https://example.com' })} />)
    const btn = screen.getByRole('button', { name: /shorten/i })
    expect(btn).not.toBeDisabled()
  })

  it('disables button and shows loading text while loading', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ url: 'https://example.com', isLoading: true })} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.textContent?.toLowerCase()).toContain('process')
  })
})

describe('ShortenForm — URL input interactions', () => {
  it('calls onUrlChange when user types in URL input', async () => {
    const onUrlChange = vi.fn()
    renderWithProviders(<ShortenForm {...defaultProps({ onUrlChange })} />)
    const input = screen.getByPlaceholderText(/paste your long url here/i)
    await userEvent.type(input, 'h')
    expect(onUrlChange).toHaveBeenCalled()
  })

  it('URL input has type="url"', () => {
    renderWithProviders(<ShortenForm {...defaultProps()} />)
    const input = screen.getByPlaceholderText(/paste your long url here/i)
    expect(input).toHaveAttribute('type', 'url')
  })

  it('URL input is disabled while loading', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ isLoading: true })} />)
    const input = screen.getByPlaceholderText(/paste your long url here/i)
    expect(input).toBeDisabled()
  })
})

describe('ShortenForm — custom alias input', () => {
  it('calls onCustomIdChange when user types', async () => {
    const onCustomIdChange = vi.fn()
    renderWithProviders(<ShortenForm {...defaultProps({ onCustomIdChange })} />)
    const input = screen.getByPlaceholderText(/custom_alias/i)
    await userEvent.type(input, 'a')
    expect(onCustomIdChange).toHaveBeenCalled()
  })

  it('strips invalid characters via onChange replacement', async () => {
    const onCustomIdChange = vi.fn()
    renderWithProviders(<ShortenForm {...defaultProps({ customId: '', onCustomIdChange })} />)
    const input = screen.getByPlaceholderText(/custom_alias/i)
    // Input has onChange that strips non-alphanumeric/underscore/hyphen
    fireEvent.change(input, { target: { value: 'my@alias#' } })
    // The handler strips invalid chars, so the prop callback receives stripped value
    expect(onCustomIdChange).toHaveBeenCalledWith('myalias')
  })

  it('reflects current customId value', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ customId: 'my-alias' })} />)
    const input = screen.getByPlaceholderText(/custom_alias/i) as HTMLInputElement
    expect(input.value).toBe('my-alias')
  })
})

describe('ShortenForm — expiry dropdown', () => {
  it('calls onExpiryChange when selection changes', async () => {
    const onExpiryChange = vi.fn()
    renderWithProviders(<ShortenForm {...defaultProps({ onExpiryChange })} />)
    const select = document.querySelector('select') as HTMLSelectElement
    await userEvent.selectOptions(select, '3600')
    expect(onExpiryChange).toHaveBeenCalledWith(3600)
  })

  it('does not show custom hours input when expiry is not -1', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ expiry: 3600 })} />)
    const customHoursInput = screen.queryByPlaceholderText(/hours/i)
    expect(customHoursInput).not.toBeInTheDocument()
  })

  it('shows custom hours input when expiry is -1 (CUSTOM)', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ expiry: -1 })} />)
    // The custom hours input appears
    const customHoursInput = screen.getByPlaceholderText(/hours/i)
    expect(customHoursInput).toBeInTheDocument()
  })

  it('calls onCustomExpiryChange when typing in custom hours input', async () => {
    const onCustomExpiryChange = vi.fn()
    renderWithProviders(<ShortenForm {...defaultProps({ expiry: -1, onCustomExpiryChange })} />)
    const hoursInput = screen.getByPlaceholderText(/hours/i)
    await userEvent.type(hoursInput, '48')
    expect(onCustomExpiryChange).toHaveBeenCalled()
  })

  it('custom hours input has type="number" with min=1', () => {
    renderWithProviders(<ShortenForm {...defaultProps({ expiry: -1 })} />)
    const hoursInput = screen.getByPlaceholderText(/hours/i)
    expect(hoursInput).toHaveAttribute('type', 'number')
    expect(hoursInput).toHaveAttribute('min', '1')
  })

  it('renders all preset expiry options', () => {
    renderWithProviders(<ShortenForm {...defaultProps()} />)
    const select = document.querySelector('select') as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toContain('0')     // Never
    expect(values).toContain('3600')  // 1 hour
    expect(values).toContain('86400') // 24 hours
    expect(values).toContain('604800') // 7 days
    expect(values).toContain('2592000') // 30 days
    expect(values).toContain('-1')    // Custom
  })
})

describe('ShortenForm — burn on read toggle', () => {
  it('calls onBurnOnReadChange when clicked', async () => {
    const onBurnOnReadChange = vi.fn()
    renderWithProviders(<ShortenForm {...defaultProps({ onBurnOnReadChange })} />)
    const toggle = screen.getByText(/burn_on_read/i)
    await userEvent.click(toggle)
    expect(onBurnOnReadChange).toHaveBeenCalledWith(true)
  })

  it('calls onBurnOnReadChange(false) when already true and clicked', async () => {
    const onBurnOnReadChange = vi.fn()
    renderWithProviders(<ShortenForm {...defaultProps({ burnOnRead: true, onBurnOnReadChange })} />)
    const toggle = screen.getByText(/burn_on_read/i)
    await userEvent.click(toggle)
    expect(onBurnOnReadChange).toHaveBeenCalledWith(false)
  })
})

describe('ShortenForm — form submission', () => {
  it('calls onSubmit when form is submitted', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    renderWithProviders(<ShortenForm {...defaultProps({ url: 'https://example.com', onSubmit })} />)
    const btn = screen.getByRole('button', { name: /shorten/i })
    await userEvent.click(btn)
    expect(onSubmit).toHaveBeenCalled()
  })
})
