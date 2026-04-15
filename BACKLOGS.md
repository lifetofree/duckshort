# Backlogs

Feature gaps, improvements, and missing roadmap items.
Items marked ✅ were resolved in the refactoring pass on 2026-04-14.

---

## Roadmap Gaps (Listed in AGENTS.MD but not implemented)

### Custom Domains
- **Status**: Marked ✅ in original AGENTS.MD but no handler implementation exists.
- **What's needed**: Route matching logic to resolve incoming requests by custom domain, and a `custom_domain` column on the `links` table.

---

## Missing Features

### Scheduled cleanup for expired links
- Expired links are soft-expired (query filters them) but never deleted from D1.
- **Approach**: Add a Cloudflare Workers Cron Trigger to purge `WHERE expires_at < CURRENT_TIMESTAMP`.

### Rate limiting
- No protection against link creation spam.
- **Approach**: Use Cloudflare WAF rate limiting rules, or implement IP-based throttle via Workers KV.

### Admin: search and filter
- All links shown in creation order with no search or sort.
- **Approach**: Add a search input and column sort on the links table.

### Custom expiration input
- Expiry options are hardcoded: NEVER / 1H / 24H / 7D / 30D.
- **Approach**: Add a "Custom (hours)" input field alongside the dropdown.

---

## Improvements

### ✅ Shared TypeScript types between backend handlers
- **Resolved**: `src/types.ts` created with shared `Bindings` type. All handlers and `index.tsx` import from it.

### ✅ Remove hardcoded fallback secret from React frontend
- **Resolved**: `frontend/src/App.tsx` reads `VITE_ADMIN_SECRET` from env; fails visibly if unset.

### ✅ Admin logout / secret clearing
- **Resolved**: `src/ui/pages/Admin.tsx` has a working Logout button that clears `_secret` and resets the UI.

### ✅ Standardise CI Node.js version
- **Resolved**: Both `deploy-worker.yml` and `deploy-frontend.yml` use Node 22.

### ✅ Enable Cloudflare observability
- **Resolved**: `wrangler.toml` sets `observability.enabled = true`.

### ✅ Error display in Stats tab
- **Resolved**: `handleViewStats` in `App.tsx` now uses `setError` instead of `alert`; error banner appears in both tabs.

### Extract inline scripts from SSR pages to static files
- `src/ui/pages/Home.tsx` and `src/ui/pages/Admin.tsx` embed large JS blocks via `dangerouslySetInnerHTML`.
- **Approach**: Move to `src/static/home.js` and `src/static/admin.js`; serve via `serveStatic` middleware and `wrangler.toml` assets config.
- **Note**: Admin.tsx secret-in-HTML issue was fixed without extraction (secret now in JS variable). Full extraction is a code quality improvement only.

### Increase test coverage
- Only 2 basic route tests exist in `test/index.test.ts`.
- **Approach**: Add Vitest handler-level tests for `createLink`, `deleteLink`, `redirectLink`, and `getStats` covering auth, 404, and happy paths.

### Pagination for stats queries
- `LIMIT 5` is hardcoded for top countries and referrers.
- **Approach**: Accept optional `?limit=N` query param in the stats handler.

### Deduplicate Duck SVG component
- Duck SVG exists in both `src/ui/components/Duck.tsx` (SSR) and `frontend/src/App.tsx` (React).
- **Approach**: Serve as a static SVG asset and reference from both contexts.

---                                                                                                                                                                                                                                                                        
  High Impact, Low Effort
                                                                                                                                                                                                                                                                             
  1. Click-through Preview Page                                                                                                                                                                                                                                            
  Before redirecting, show a branded interstitial with the destination URL so users can verify the link is safe. Opt-in via ?preview=1 or a separate short URL prefix (e.g. d.uck.sh/preview/abc123). Zero new DB columns needed.
                                                                                                                                                                                                                                                                             
  2. QR Code Generation                                                                                                                                                                                                                                                      
  On link creation, generate a QR code for the short URL. The qrcode npm package works in Workers. Display it in the modal alongside the copy button — very shareable.                                                                                                       
                                                                                                                                                                                                                                                                             
  3. One-click Link Disable (without delete)                                                                                                                                                                                                                                 
  Add an active BOOLEAN DEFAULT 1 column. Redirect returns 404 if active = 0. Admin can toggle without losing the link and its analytics history.                                                                                                                            
                                                                                                                                                                                                                                                                             
  4. Password-protected Links                                                                                                                                                                                                                                              
  Add an optional password_hash TEXT column. On redirect, if set, show an interstitial asking for the password before forwarding. Useful for sharing private resources.                                                                                                      
                                                                                                                                                                                                                                                                             
  ---
  High Impact, Medium Effort                                                                                                                                                                                                                                                 
                                                                                                                                                                                                                                                                           
  5. Link Bundles / Campaigns
  Group related links under a tag (e.g. campaign = "launch-2025"). Admin can view aggregate stats across all links in a bundle — useful for marketing.
                                                                                                                                                                                                                                                                             
  6. UTM Parameter Injection                                                                                                                                                                                                                                                 
  Let users append UTM params at creation time (utm_source, utm_medium, utm_campaign). The redirect handler appends them to the destination URL automatically.                                                                                                               
                                                                                                                                                                                                                                                                             
  7. Webhook on Click                                                                                                                                                                                                                                                      
  Fire a waitUntil POST to a user-configured webhook URL on every redirect — lets users pipe click events into Slack, Zapier, or their own analytics without polling the stats API.                                                                                          
                                                                                                                                                                                                                                                                             
  8. Link Rotation (A/B)                                                                                                                                                                                                                                                     
  One short URL, multiple destination URLs. The redirect handler picks one by weighted random. Great for A/B testing landing pages.                                                                                                                                          
                                                                                                                                                                                                                                                                             
  ---                                                                                                                                                                                                                                                                      
  Medium Impact, Low Effort                                                                                                                                                                                                                                                  
                                                                                                                                                                                                                                                                             
  9. Visit Sparkline in Admin Table
  Store daily visit counts in analytics. Admin table shows a tiny 7-day sparkline per link using an inline SVG — visual at a glance without leaving the page.                                                                                                                
                                                                                                                                                                                                                                                                             
  10. Expiry Extension                                                                                                                                                                                                                                                       
  Button in admin to extend a link's expires_at by N hours without deleting and recreating it. Currently there's no way to do this.                                                                                                                                          
                                                                                                                                                                                                                                                                             
  11. Bulk Delete / Bulk Export CSV                                                                                                                                                                                                                                        
  Checkbox multi-select in admin table. Export selected links + their stats as a CSV download (generated client-side from the API response, no new endpoint needed).                                                                                                         
                                                                                                                                                                                                                                                                             
  ---                                                                                                                                                                                                                                                                        
  Fun / On-brand                                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                                             
  12. "Quack" Easter Egg Counter                                                                                                                                                                                                                                           
  Track how many total redirects the whole system has served. Display the milestone on the home page ("🦆 1,000,000 quacks served"). One extra SELECT COUNT(*) FROM analytics query.
                                                                                                                                                                                                                                                                             
  13. Duck Mood Indicator
  The logo changes expression based on system health — normal duck when all is well, sunglasses duck when traffic is high, sad duck when error rate spikes. Reads from Cloudflare observability data.                                                                        
                                                                                                                                                                                                                                                                             
  ---
