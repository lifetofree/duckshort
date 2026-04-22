/**
 * Isolated unit tests for the ResultModal component.
 * Tests QR code display, URL display, copy button, and close interactions.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResultModal } from '../components/ResultModal'
import { renderWithProviders } from '../test/renderWithProviders'

const SHORT_URL = 'https://duckshort.cc/abc12345'

function renderModal(overrides: Partial<Parameters<typeof ResultModal>[0]> = {}) {
  const props = {
    shortUrl: SHORT_URL,
    copySuccess: false,
    onCopy: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  return renderWithProviders(<ResultModal {...props} />)
}

describe('ResultModal — rendering', () => {
  it('renders the modal title', () => {
    renderModal()
    expect(screen.getByText(/link created/i)).toBeInTheDocument()
  })

  it('displays the short URL in a readonly input', () => {
    renderModal()
    const input = screen.getByDisplayValue(SHORT_URL) as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('readonly')
  })

  it('renders a QR code SVG for the short URL', () => {
    renderModal()
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders the copy-to-clipboard button', () => {
    renderModal()
    expect(screen.getByText(/copy to clipboard/i)).toBeInTheDocument()
  })

  it('renders the close button', () => {
    renderModal()
    expect(screen.getByText(/close/i)).toBeInTheDocument()
  })

  it('shows "COPIED" text when copySuccess is true', () => {
    renderModal({ copySuccess: true })
    expect(screen.getByText(/copied/i)).toBeInTheDocument()
  })

  it('shows "COPY TO CLIPBOARD" when copySuccess is false', () => {
    renderModal({ copySuccess: false })
    expect(screen.getByText(/copy to clipboard/i)).toBeInTheDocument()
  })
})

describe('ResultModal — interactions', () => {
  it('calls onCopy when copy button is clicked', async () => {
    const onCopy = vi.fn()
    renderModal({ onCopy })
    const copyBtn = screen.getByText(/copy to clipboard/i)
    await userEvent.click(copyBtn)
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    const closeBtn = screen.getByText(/close/i)
    await userEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when overlay background is clicked', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    const overlay = document.querySelector('.modal-overlay')
    expect(overlay).toBeInTheDocument()
    await userEvent.click(overlay!)
    expect(onClose).toHaveBeenCalled()
  })

  it('does NOT call onClose when clicking inside the modal content', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    const content = document.querySelector('.modal-content')
    expect(content).toBeInTheDocument()
    await userEvent.click(content!)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ResultModal — URL display', () => {
  it('displays the correct short URL value', () => {
    const url = 'https://duckshort.cc/custom-alias'
    renderModal({ shortUrl: url })
    const input = screen.getByDisplayValue(url)
    expect(input).toBeInTheDocument()
  })

  it('the short URL input is read-only', () => {
    renderModal()
    const input = screen.getByDisplayValue(SHORT_URL)
    expect(input).toHaveAttribute('readonly')
  })
})
