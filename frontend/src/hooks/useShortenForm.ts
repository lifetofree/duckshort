import { useCallback, useState } from 'react'
import { CUSTOM_ID_REGEX } from '../lib/constants'
import type { TranslationParams } from '../lib/i18n'

const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

interface ShortenResponse {
  shortUrl?: string
  error?: string
}

interface UseShortenFormOptions {
  /** i18n translation function (so hook stays decoupled from i18n) */
  t: (key: string, params?: TranslationParams) => string
}

interface UseShortenFormResult {
  url: string
  customId: string
  burnOnRead: boolean
  expiry: number
  customExpiry: string
  isLoading: boolean
  error: string | null
  shortUrl: string | null
  copySuccess: boolean
  setUrl: (v: string) => void
  setCustomId: (v: string) => void
  setBurnOnRead: (v: boolean) => void
  setExpiry: (v: number) => void
  setCustomExpiry: (v: string) => void
  setError: (e: string | null) => void
  handleShorten: (e: React.FormEvent) => Promise<void>
  handleCopy: () => Promise<void>
  closeResult: () => void
}

/**
 * Encapsulates the shorten-form state and POST /api/links submission.
 * Returns a flat object that the <ShortenForm /> and <ResultModal />
 * components already understand, so the refactor is drop-in.
 *
 * Validation:
 *  - URL must parse via the URL constructor
 *  - Custom id (if set) must match CUSTOM_ID_REGEX
 *
 * The endpoint is rate-limited on the server; the hook surfaces the error
 * message via `error` so the caller can render it.
 */
export function useShortenForm({ t }: UseShortenFormOptions): UseShortenFormResult {
  const [url, setUrl] = useState('')
  const [customId, setCustomId] = useState('')
  const [burnOnRead, setBurnOnRead] = useState(false)
  const [expiry, setExpiry] = useState(0)
  const [customExpiry, setCustomExpiry] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const handleShorten = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!url.trim()) return
      try {
        new URL(url)
      } catch {
        setError(t('home.shortenForm.errors.invalidUrl'))
        return
      }
      if (customId.trim() && !CUSTOM_ID_REGEX.test(customId.trim())) {
        setError(t('home.shortenForm.errors.invalidCustomId'))
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const expiresIn =
          expiry === -1
            ? parseInt(customExpiry, 10) * 3600 || undefined
            : expiry || undefined
        const res = await fetch(`${API}/api/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            url,
            customId: customId.trim() || undefined,
            burn_on_read: burnOnRead,
            expiresIn,
          }),
        })
        const data = (await res.json()) as ShortenResponse
        if (res.ok) {
          setShortUrl(data.shortUrl ?? null)
          setCustomId('')
          setBurnOnRead(false)
        } else {
          setError(data.error ?? t('home.shortenForm.errors.failedToShorten', { status: res.status }))
        }
      } catch (err) {
        console.error('Shorten error:', err)
        setError(t('home.shortenForm.errors.networkError'))
      } finally {
        setIsLoading(false)
      }
    },
    [url, customId, burnOnRead, expiry, customExpiry, t],
  )

  const handleCopy = useCallback(async () => {
    if (!shortUrl) return
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      /* clipboard API unavailable (e.g. insecure context) — silently ignore */
    }
  }, [shortUrl])

  const closeResult = useCallback(() => {
    setShortUrl(null)
    setCopySuccess(false)
  }, [])

  return {
    url,
    customId,
    burnOnRead,
    expiry,
    customExpiry,
    isLoading,
    error,
    shortUrl,
    copySuccess,
    setUrl,
    setCustomId,
    setBurnOnRead,
    setExpiry,
    setCustomExpiry,
    setError,
    handleShorten,
    handleCopy,
    closeResult,
  }
}
