# Backlogs

Active feature gaps, improvements, and missing roadmap items.
Resolved items are archived in `HISTORY.md`.

---

## Roadmap Gaps

### Custom Domains
- **Status**: Not yet implemented.
- **Approach**: Route matching logic to resolve incoming requests by custom domain, and a `custom_domain` column on the `links` table.

---

## Missing Features

### Admin: search and filter
- All links shown in creation order with no search or sort.
- **Approach**: Add a search input and column sort on the links table.

---

## Improvements

### Neon Heatmap Visualization
- Transform the existing country stats into a visual geographic heatmap.
- **Approach**: Integrate a lightweight SVG map library in the `Home.tsx` stats tab to visualize `cf-ipcountry` data with neon glows.

### Geo-Fencing Redirects
- Redirect users to different URLs based on their country.
- **Approach**: Leverage the `cf-ipcountry` header in the redirect handler to match against a new `geo_redirects` table or column.

### Pagination for stats queries (frontend)
- The backend now accepts `?limit=N` (1–100, default 10) for top countries/referrers.
- **Approach**: Expose a limit selector in `StatsView.tsx` so users can choose how many rows to show.

---

## Code Quality

### [LOW] CORS is fully open
- `origin: (origin) => origin ?? '*'` in `src/index.tsx` allows any origin.
- Not a bug for a public tool, but should be documented as intentional.
