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

### Custom expiration input
- Expiry options are hardcoded: NEVER / 1H / 24H / 7D / 30D.
- **Approach**: Add a "Custom (hours)" input field alongside the dropdown.

---

## Improvements

### Neon Heatmap Visualization
- Transform the existing country stats into a visual geographic heatmap.
- **Approach**: Integrate a lightweight SVG map library in the `Home.tsx` stats tab to visualize `cf-ipcountry` data with neon glows.

### Meta-Duck OG Tag Customization
- Customize Social Preview (OpenGraph) tags for the Preview Interstitial page.
- **Approach**: Add `og_title` and `og_image` columns to the database and inject them into the `Preview.tsx` SSR template.

### Geo-Fencing Redirects
- Redirect users to different URLs based on their country.
- **Approach**: Leverage the `cf-ipcountry` header in the redirect handler to match against a new `geo_redirects` table or column.

### Extract inline scripts from SSR pages to static files
- `src/ui/pages/Home.tsx` and `src/ui/pages/Admin.tsx` embed large JS blocks via `dangerouslySetInnerHTML`.
- **Approach**: Move to static `.js` files and serve via `serveStatic` middleware.

### Increase test coverage
- **Approach**: Add Vitest handler-level tests for `createLink`, `deleteLink`, `redirectLink`, and `getStats` covering auth, 404, and happy paths.

### Pagination for stats queries
- `LIMIT 5` is currently hardcoded for top countries and referrers.
- **Approach**: Accept optional `?limit=N` query param in the stats handler.
