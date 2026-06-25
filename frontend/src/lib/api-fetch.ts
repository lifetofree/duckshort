import { readCookie } from './cookies'

export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const csrf = readCookie('XSRF-TOKEN')
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
  if (csrf) headers['X-XSRF-TOKEN'] = csrf
  return fetch(url, { ...init, headers, credentials: 'include' })
}
