export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  if (aBytes.length !== bBytes.length) return false
  return (crypto.subtle as any).timingSafeEqual(aBytes, bBytes)
}

export async function requireAuth(
  env: { ADMIN_SECRET: string },
  header: string | null | undefined,
  cookieHeader?: string | null
): Promise<Response | null> {
  const unauthorized = new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
  if (!env.ADMIN_SECRET) return unauthorized

  // Accept Bearer token
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7)
    if (await timingSafeEqual(token, env.ADMIN_SECRET)) return null
  }

  // Accept admin_token cookie as fallback
  if (cookieHeader) {
    const token = cookieHeader.split(';').map(s => s.trim())
      .find(s => s.startsWith('admin_token='))?.slice('admin_token='.length)
    if (token && await timingSafeEqual(token, env.ADMIN_SECRET)) return null
  }

  return unauthorized
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password)
  return computed === hash
}
