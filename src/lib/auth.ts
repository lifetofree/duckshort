export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  if (aBytes.length !== bBytes.length) {
    return false
  }
  return crypto.subtle.timingSafeEqual(aBytes, bBytes)
}

export function requireAuth(env: { ADMIN_SECRET: string }, header: string | null): Response | null {
  if (!header || !header.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }
  const token = header.slice(7)
  const match = timingSafeEqual(token, env.ADMIN_SECRET)
  if (!match) {
    return new Response('Unauthorized', { status: 401 })
  }
  return null
}