// 4.1: Type-safe env access. Hono's `c.env` is typed but every optional field
// still surfaces as `T | undefined`. Wrapping the reads here turns the
// fallbacks into a single source of truth — adding a new optional env var
// only touches this file.
import type { Env } from '../types'

/** Strip a trailing slash from any URL. */
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/** Cloudflare Pages origin used by the SPA proxy in `src/index.tsx`. */
export function pagesOrigin(env: Env): string {
  return stripTrailingSlash(env.PAGES_URL ?? 'https://duckshort.pages.dev')
}

/** Base URL the SPA uses to build short links (mirrors `pagesOrigin` for now). */
export function baseUrl(env: Env): string {
  return stripTrailingSlash(env.BASE_URL ?? 'https://duckshort.cc')
}
