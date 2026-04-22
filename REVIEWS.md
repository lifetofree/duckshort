# Code Review: develop branch (2026-04-21)

## Scope

All changed files in the current branch (24 files, ~611 insertions, ~104 deletions):
Admin dashboard UI, geo-redirects, neon heatmap, sparkline, CSV export, custom domains, stats limit selector, and related test/backend changes.

**Test status:** 113/113 tests passing (13 test files)

---

## Overall Assessment: LGTM

No blocking issues. All features are correctly implemented with appropriate auth, rate limiting, and input validation. The codebase is production-ready.

---

## Findings

### [P2] Stats header shows configured limit, not actual result count

**File:** `frontend/src/components/StatsView.tsx` (lines 140, 155)

**Problem:** The section headers display `({statsLimit})` — the configured limit from state — rather than the actual number of countries/referrers returned. If the API returns 3 countries but `statsLimit = 10`, the header reads "Top Countries (10)" while only 3 are rendered.

**Current:**
```tsx
{translate('home.stats.topCountries')} ({statsLimit})
```

**Suggested fix:**
```tsx
{translate('home.stats.topCountries')} ({stats.countries?.length ?? 0})
```
(and similarly for referrers: `stats.referrers?.length ?? 0`)

---

### [P2] CSV export ignores active search and status filters

**File:** `frontend/src/pages/Admin.tsx` (export button, ~line 670)

**Problem:** The "EXPORT CSV" button calls `GET /api/links/export` directly, which returns all links. It bypasses `searchQuery` and `statusFilter`, so a filtered view of 5 disabled links still exports the full table.

**Current behavior:** Downloads entire `links` table regardless of UI filters.

**Options:**
1. Add query parameters to the export endpoint to match current filters (`/api/links/export?q=&status=`), or
2. Filter the exported data client-side before download, or
3. Document that export always returns all links (may be intentional)

---

### [P2] Duplicate geo-redirect lookup logic in `resolveCustomDomain` and `redirectLink`

**Files:**
- `src/middleware/customDomain.ts` (lines 74-79)
- `src/handlers/redirect.tsx` (lines 65-70)

**Problem:** Both implement identical geo-redirect selection:

```tsx
const country = c.req.header('cf-ipcountry') || 'unknown'
if (country && country !== 'unknown') {
  const geoRedirect = await c.env.DB.prepare(
    'SELECT destination_url FROM geo_redirects WHERE link_id = ? AND country_code = ?'
  ).bind(link.id, country.toUpperCase()).first<{ destination_url: string }>()
  if (geoRedirect) { destination = geoRedirect.destination_url }
}
```

If one location is patched without updating the other, behavior diverges between custom-domain requests and primary-domain requests.

**Suggested fix:** Extract to a shared helper in `src/lib/`:

```tsx
export async function applyGeoRedirect(env: Env, linkId: string, country: string): Promise<string | null>
```

---

### [P3] `NeonHeatmap` guard is present but fragile

**File:** `frontend/src/components/NeonHeatmap.tsx`

The early-return guard `if (!countries || countries.length === 0) return null` correctly prevents `Math.max()` on an empty array. However, if that guard is ever removed or bypassed, `Math.max(...[])` returns `-Infinity`, which would produce `NaN` intensities. Not a bug in current code — worth noting for future maintenance.

---

### [P3] `disabled` field typed as `number` (D1 0/1) but used with truthy checks

**File:** `frontend/src/pages/Admin.tsx` (line 11)

The `Link` interface has `disabled: number`. Code like `link.disabled ? ...` works because 0 is falsy, but this relies on implicit number-to-boolean coercion. Pattern is consistent throughout the codebase and all tests pass. Low risk.

---

## Security Assessment: ✅ Sound

| Area | Status |
|------|--------|
| Bearer auth on admin endpoints | All new geo-redirect endpoints protected |
| Timing-safe secret comparison | `requireAuth()` using `timingSafeEqual` |
| Custom domain input validation | Regex `/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}[a-zA-Z0-9]$/` |
| Country code validation | `/^[A-Z]{2}$/` before insert |
| SQL injection | All params bound via D1 `.bind()` |
| Rate limiting | Applied to `POST /api/links` and `POST /api/links/bulk-delete` |
| Password hashing | SHA-256 via Web Crypto |
| Burn-on-read atomic disable | `UPDATE ... WHERE disabled = 0` with `changes` check |

---

## Verified Working Features

- Admin dashboard with tabbed UI (links/create/stats/link-stats)
- Geo-redirect CRUD with country code validation
- A/B variant management
- Custom domain assignment with format + uniqueness validation
- Neon heatmap visualization with cyan→magenta gradient
- 7-day sparkline in stats view and per-link admin stats
- Bulk CSV export with proper CSV escaping
- Configurable stats limit selector (5/10/25/50/100)
- Sparkline data in `GET /api/stats/:id` response

---

*Review Date: 2026-04-21*
*Reviewer: Code Review Skill*
