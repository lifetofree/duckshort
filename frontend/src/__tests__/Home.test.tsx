import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../lib/i18n'
import HomePage from '../pages/Home'

function renderHome() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </I18nProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HomePage', () => {
  it('renders the URL input and shorten button', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    renderHome()
    expect(screen.getByPlaceholderText(/paste your long url here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /shorten!/i })).toBeInTheDocument()
  })

  it('shows error for invalid URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    renderHome()
    const input = screen.getByPlaceholderText(/paste your long url here/i)
    await userEvent.type(input, 'not-a-url')
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/invalid url/i)).toBeInTheDocument()
    })
  })

  it('shows modal with short URL on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 42, hourlyVisits: 1, mood: 'ACTIVE' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ shortUrl: 'http://localhost/abc12345' }))
    )
    // 3rd call: effect re-runs when shortUrl changes
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 43, hourlyVisits: 1, mood: 'ACTIVE' }))
    )

    renderHome()
    const input = screen.getByPlaceholderText(/paste your long url here/i)
    await userEvent.type(input, 'https://example.com')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/link created/i)).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('http://localhost/abc12345')).toBeInTheDocument()
  })

  it('shows error message on API failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Server error' }), { status: 400 })
    )

    renderHome()
    const input = screen.getByPlaceholderText(/paste your long url here/i)
    await userEvent.type(input, 'https://example.com')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })

  it('shows network error when fetch throws', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    renderHome()
    const input = screen.getByPlaceholderText(/paste your long url here/i)
    await userEvent.type(input, 'https://example.com')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })
})
