/**
 * Read a cookie value by name from document.cookie. Returns null when the
 * cookie is absent, the document is unavailable (SSR / non-browser), or the
 * cookie value is empty.
 *
 * The XSRF-TOKEN cookie is non-HttpOnly, so the SPA can read it and echo it
 * back as the X-XSRF-TOKEN header on state-changing requests — the backend
 * verifies the cookie and header match via timingSafeEqual.
 */
export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie ? document.cookie.split(';') : []
  for (const part of cookies) {
    const trimmed = part.trim()
    const prefix = `${name}=`
    if (trimmed.startsWith(prefix)) {
      const value = trimmed.slice(prefix.length)
      return value || null
    }
  }
  return null
}
