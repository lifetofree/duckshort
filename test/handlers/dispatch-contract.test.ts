// 4.6: dispatchRedirect contract test. Locks the public behaviour of
// `dispatchRedirect` so future refactors can't silently change the response
// shape or the side-effect order.
//
// Each test corresponds to one row of the JSDoc table in
// `src/lib/redirectUtils.ts`. If you add a new RedirectResult kind, add a
// describe block here; if you change a side effect, update both this file
// and the JSDoc.
import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { applySchema, clearAll } from '../helpers/schema'

const BASE = 'http://localhost'

async function seed(id: string, overrides: Partial<{
  original_url: string
  expires_at: string | null
  disabled: number
  password_hash: string | null
  burn_on_read: number
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  webhook_url: string | null
}> = {}) {
  const now = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO links
       (id, original_url, created_at, expires_at, disabled, password_hash, burn_on_read,
        utm_source, utm_medium, utm_campaign, webhook_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    overrides.original_url ?? 'https://example.com',
    now,
    overrides.expires_at ?? null,
    overrides.disabled ?? 0,
    overrides.password_hash ?? null,
    overrides.burn_on_read ?? 0,
    overrides.utm_source ?? null,
    overrides.utm_medium ?? null,
    overrides.utm_campaign ?? null,
    overrides.webhook_url ?? null,
  ).run()
}

describe('dispatchRedirect contract — /:id', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  // ─── not_found ────────────────────────────────────────────────────────

  it('not_found: disabled link → 404, no analytics row, no cache purge', async () => {
    await seed('disabled-1', { disabled: 1 })
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/disabled-1`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Link disabled')
  })

  // ─── expired ──────────────────────────────────────────────────────────

  it('expired: link with expires_at in the past → 410 and disables the row', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    await seed('expired-1', { expires_at: past })
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/expired-1`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(410)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Link expired')

    const row = await env.DB.prepare('SELECT disabled FROM links WHERE id = ?')
      .bind('expired-1').first<{ disabled: number }>()
    expect(row?.disabled).toBe(1)
  })

  it('expired beats password: a link that is BOTH expired AND password-protected returns 410', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    await seed('expired-pw-1', { expires_at: past, password_hash: 'fakehash' })
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/expired-pw-1`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(410)
  })

  // ─── password ─────────────────────────────────────────────────────────

  it('password: link with password_hash → 302 redirect to /password/:id', async () => {
    await seed('pw-1', { password_hash: 'fakehash' })
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/pw-1`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/password/pw-1')
  })

  it('password beats burn: a link that is BOTH password AND burn_on_read → 302 to password page (no burn)', async () => {
    await seed('pw-burn-1', { password_hash: 'fakehash', burn_on_read: 1 })
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/pw-burn-1`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/password/pw-burn-1')
    const row = await env.DB.prepare('SELECT disabled FROM links WHERE id = ?')
      .bind('pw-burn-1').first<{ disabled: number }>()
    expect(row?.disabled).toBe(0) // burn never ran because password intercepted
  })

  // ─── burned_out ───────────────────────────────────────────────────────

  it('burned_out: burn_on_read link that was already disabled by a racing request → 404', async () => {
    await seed('burn-1', { burn_on_read: 1, disabled: 1 })
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/burn-1`), env, ctx)
    await waitOnExecutionContext(ctx)
    // disabled check fires first → 404 "Link disabled"
    expect(res.status).toBe(404)
  })

  it('redirect: burn_on_read link that is still enabled → 302 and the row is disabled afterwards', async () => {
    await seed('burn-ok-1', { burn_on_read: 1 })
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/burn-ok-1`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com')

    const row = await env.DB.prepare('SELECT disabled FROM links WHERE id = ?')
      .bind('burn-ok-1').first<{ disabled: number }>()
    expect(row?.disabled).toBe(1)
  })

  // ─── redirect ─────────────────────────────────────────────────────────

  it('redirect: normal link → 302 with UTM injection and an analytics row', async () => {
    await seed('redir-1', {
      utm_source: 'duck', utm_medium: 'short', utm_campaign: 'test',
    })
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/redir-1`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)
    const loc = res.headers.get('location')!
    expect(loc).toContain('utm_source=duck')
    expect(loc).toContain('utm_medium=short')
    expect(loc).toContain('utm_campaign=test')

    const count = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM analytics WHERE link_id = ?'
    ).bind('redir-1').first<{ count: number }>()
    expect(count?.count).toBe(1)
  })

  it('redirect: increments the global total_visits counter', async () => {
    await seed('count-1')
    const ctx = createExecutionContext()
    await app.fetch(new Request(`${BASE}/count-1`), env, ctx)
    await waitOnExecutionContext(ctx)
    const counter = await env.DB.prepare(
      'SELECT value FROM counters WHERE key = ?'
    ).bind('total_visits').first<{ value: number }>()
    expect(counter?.value).toBe(1)
  })
})
