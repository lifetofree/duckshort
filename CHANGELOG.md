# Changelog

All notable changes to the DuckShort project will be documented in this file.

## [1.1.0] - 2026-04-16

### Added
- **Custom Pond Aliases (Vanity URLs):** Users can now specify a custom short ID (e.g., `/my-brand`) when creating a link. Includes duplicate collision checking.
- **Burn-on-Read (Self-Destruction):** Optional toggle for links to disable themselves immediately after the first successful redirect or password verification.
- **Themed SSR Error Pages:** Custom 404/Expired/Not Found pages with the "Neon Pond" aesthetic (Magenta/Cyan/Orbitron).
- **Scheduled Link Cleanup:** Background cron trigger (`0 * * * *`) that automatically purges expired links from D1.
- **Global Stats Refresh:** Frontend now polls global "Quack" counts and "Duck Mood" every 30 seconds.

### Changed
- **Wrangler v4 Migration:** Upgraded the worker runtime and CLI to Wrangler ^4.83.0.
- **Edge-Native Expiry:** Switched expiration checks to use SQLite's `datetime('now')` for consistent timing across all edge nodes.
- **Improved Stats Lookup:** The stats search form now extracts the ID if a full URL is pasted.
- **Frontend Theme Sync:** Unified the "Neon Pond" palette across the SPA and SSR components via CSS variables in `Layout.tsx`.

### Fixed
- **Password Analytics:** Fixed a bug where password-protected links were not firing webhooks or recording analytics.
- **JSX Build Error:** Renamed `redirect.ts` to `redirect.tsx` to fix a syntax error when rendering JSX components.
- **Rate Limit Safety:** Added a fallback check to skip rate limiting gracefully if the KV namespace is not configured.
- **Mobile Styling:** Fixed padding issues on the 404 and Home pages when the development bar is active.

## [1.0.0] - 2026-04-14

### Added
- Initial release with Hono.js + D1 + React.
- Basic link shortening and A/B rotation.
- Timing-safe admin authentication.
- Cyber-Duck "Neon Pond" visual theme.
