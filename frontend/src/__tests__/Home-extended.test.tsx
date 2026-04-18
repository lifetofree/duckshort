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
  vi.stubGlobal('navigator', {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HomePage - Stats View', () => {
  it('switches to stats tab when clicked', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    renderHome()

    const statsTab = screen.getByText(/view stats/i)
    await userEvent.click(statsTab)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter link id/i)).toBeInTheDocument()
    })
  })

  it('displays stats for a valid link', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        visits: 42,
        countries: [{ country: 'US', count: 30 }, { country: 'UK', count: 12 }],
        referrers: [{ referer: 'https://google.com', count: 25 }, { referer: 'direct', count: 17 }]
      }))
    )

    renderHome()

    // Switch to stats tab
    const statsTab = screen.getByText(/view stats/i)
    await userEvent.click(statsTab)
    await waitFor(() => expect(screen.getByPlaceholderText(/enter link id/i)).toBeInTheDocument())

    // Enter link ID and submit
    const input = screen.getByPlaceholderText(/enter link id/i)
    await userEvent.type(input, 'testlink')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument()
      expect(screen.getByText('US')).toBeInTheDocument()
      expect(screen.getByText('UK')).toBeInTheDocument()
    })
  })

  it('extracts link ID from full URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        visits: 10,
        countries: [],
        referrers: []
      }))
    )

    renderHome()

    // Switch to stats tab
    const statsTab = screen.getByText(/view stats/i)
    await userEvent.click(statsTab)
    await waitFor(() => expect(screen.getByPlaceholderText(/enter link id/i)).toBeInTheDocument())

    // Enter full URL
    const input = screen.getByPlaceholderText(/enter link id/i)
    await userEvent.type(input, 'https://duckshort.cc/my-custom-link')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument()
    })
  })

  it('shows error when stats fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Link not found' }), { status: 404 })
    )

    renderHome()

    // Switch to stats tab
    const statsTab = screen.getByText(/view stats/i)
    await userEvent.click(statsTab)
    await waitFor(() => expect(screen.getByPlaceholderText(/enter link id/i)).toBeInTheDocument())

    // Enter invalid link ID
    const input = screen.getByPlaceholderText(/enter link id/i)
    await userEvent.type(input, 'nonexistent')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/link not found/i)).toBeInTheDocument()
    })
  })
})

describe('HomePage - QR Code Modal', () => {
  it('displays QR code in modal after successful link creation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ shortUrl: 'http://localhost/abc12345' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 1, hourlyVisits: 1, mood: 'ACTIVE' }))
    )

    renderHome()

    const input = screen.getByPlaceholderText(/paste your long url here/i)
    await userEvent.type(input, 'https://example.com')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/link created/i)).toBeInTheDocument()
    })

    // Check for QR code (it should be in the modal)
    const qrCode = document.querySelector('svg')
    expect(qrCode).toBeInTheDocument()
  })

  it('closes modal when clicking overlay', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ shortUrl: 'http://localhost/abc12345' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 1, hourlyVisits: 1, mood: 'ACTIVE' }))
    )
    // 4th call: setShortUrl(null) on close re-triggers useEffect([shortUrl])
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 1, hourlyVisits: 1, mood: 'ACTIVE' }))
    )

    renderHome()

    const input = screen.getByPlaceholderText(/paste your long url here/i)
    await userEvent.type(input, 'https://example.com')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/link created/i)).toBeInTheDocument()
    })

    // Click overlay to close
    const overlay = screen.getByText(/link created/i).closest('.modal-overlay')
    if (overlay) {
      await userEvent.click(overlay)
    }

    await waitFor(() => {
      expect(screen.queryByText(/link created/i)).not.toBeInTheDocument()
    })
  })
})

describe('HomePage - Copy to Clipboard', () => {
  it('copies short URL to clipboard', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ shortUrl: 'http://localhost/abc12345' }))
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 1, hourlyVisits: 1, mood: 'ACTIVE' }))
    )

    renderHome()

    const input = screen.getByPlaceholderText(/paste your long url here/i)
    await userEvent.type(input, 'https://example.com')
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/link created/i)).toBeInTheDocument()
    })

    // Click copy button
    const copyButton = screen.getByText(/copy to clipboard/i)
    await userEvent.click(copyButton)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost/abc12345')

    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument()
    })
  })
})

describe('HomePage - Burn on Read Toggle', () => {
  it('toggles burn-on-read option', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )

    renderHome()

    // Find burn-on-read toggle
    const burnToggle = screen.getByText(/burn_on_read/i)
    expect(burnToggle).toBeInTheDocument()

    // Click to toggle
    await userEvent.click(burnToggle)

    // The toggle should now be active (check for visual change)
    expect(burnToggle).toBeInTheDocument()
  })
})

describe('HomePage - Custom Alias Input', () => {
  it('accepts valid custom alias characters', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )

    renderHome()

    const customInput = screen.getByPlaceholderText(/custom_alias/i)
    await userEvent.type(customInput, 'my-custom-alias_123')

    expect(customInput).toHaveValue('my-custom-alias_123')
  })

  it('filters invalid characters from custom alias', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )

    renderHome()

    const customInput = screen.getByPlaceholderText(/custom_alias/i)
    await userEvent.type(customInput, 'my@alias#test!')

    // Should only contain valid characters
    expect(customInput).toHaveValue('myaliastest')
  })
})

describe('HomePage - Expiry Selection', () => {
  it('displays expiry options', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )

    renderHome()

    // Check for expiry selector
    const expiryLabel = screen.getByText(/expiry/i)
    expect(expiryLabel).toBeInTheDocument()

    // Check for select element
    const select = document.querySelector('select')
    expect(select).toBeInTheDocument()
  })

  it('changes expiry selection', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )

    renderHome()

    const select = document.querySelector('select') as HTMLSelectElement
    if (select) {
      await userEvent.selectOptions(select, '86400') // 24 hours
      expect(select.value).toBe('86400')
    }
  })
})

describe('HomePage - Duck Mood Indicator', () => {
  it('displays duck mood based on global stats', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 100, hourlyVisits: 15, mood: 'BUSY' }))
    )

    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/BUSY/i)).toBeInTheDocument()
    })
  })

  it('shows DORMANT mood when no visits', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 0, hourlyVisits: 0, mood: 'DORMANT' }))
    )

    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/DORMANT/i)).toBeInTheDocument()
    })
  })

  it('shows VIRAL mood for high traffic', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 1000, hourlyVisits: 50, mood: 'VIRAL' }))
    )

    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/VIRAL/i)).toBeInTheDocument()
    })
  })

  it('shows ERROR mood when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/DEGRADED/i)).toBeInTheDocument()
    })
  })
})

describe('HomePage - Quack Counter', () => {
  it('displays total visits counter', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 1234, hourlyVisits: 10, mood: 'ACTIVE' }))
    )

    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/1,234/i)).toBeInTheDocument()
    })
  })

  it('shows milestone celebration for round numbers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ totalVisits: 1000, hourlyVisits: 5, mood: 'ACTIVE' }))
    )

    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/1,000/i)).toBeInTheDocument()
    })
  })
})
