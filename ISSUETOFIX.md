# Issues To Fix

Remaining bugs and technical debt items.
Previous resolved issues are archived in `HISTORY.md`.

---

## Code Inconsistencies

### [LOW] Inline scripts in SSR pages
- **Files**: `src/ui/pages/Home.tsx:126`, `src/ui/pages/Admin.tsx`
- **Status**: Partially addressed — Admin.tsx secret handling fixed. Full extraction to static `.js` files remains a goal.
- **Approach**: Move to `src/static/home.js` and `src/static/admin.js`; serve via `serveStatic` middleware and `wrangler.toml` assets config.
- **Note**: This is a code quality and security-in-depth improvement.
