# Code Review: Additional Locales (Thai)

## Scope
Reviewing the implementation of Thai language support and the locale switcher component.

### Files Reviewed
- [frontend/src/lib/i18n.tsx](../frontend/src/lib/i18n.tsx)
- [frontend/src/locales/lang-th.json](../frontend/src/locales/lang-th.json)
- [frontend/src/locales/lang-en.json](../frontend/src/locales/lang-en.json)
- [frontend/src/components/LanguageSwitcher.tsx](../frontend/src/components/LanguageSwitcher.tsx)
- [frontend/src/pages/Home.tsx](../frontend/src/pages/Home.tsx)
- [frontend/src/__tests__/i18n.test.tsx](../frontend/src/__tests__/i18n.test.tsx)

## Assessment
**Status**: Approved

### 1. Code Quality & Standards
- **Strict Typing**: The `Locale` type is properly defined as `'en' | 'th'`. Functions are fully typed.
- **Dependency Constraints**: No external dependencies added, keeping bundle size footprint minimal.
- **Theme and Aesthetics**: The language switcher uses custom inline style variables matching "The Neon Pond" color palette (`--neon-cyan`, `--text-secondary`, `--bg-secondary`).

### 2. Functional Verification
- **AC-1 (Translation Coverage)**: verified. `lang-en.json` and `lang-th.json` now contain a structurally 1:1 set of 50 leaf keys each (verified via key-set diff). All keys referenced by `t()`/`translate()` calls in the source resolve to a Thai string when the Thai locale is active.
- **AC-2 (Persistence)**: verified. Active locale persists via `localStorage.getItem('duckshort_locale')` / `setItem('duckshort_locale')`.
- **AC-3 (SPA behavior)**: verified. React Context propagation works synchronously.
- **AC-4 (English Fallback)**: verified. Fallback to English is implemented in the `t` lookup sequence; the i18n test covers the terminal raw-key fallback using a key absent from both dictionaries.

### 3. Test Coverage
- The full frontend suite is **144 tests across 9 files** (verified via `vitest --run`): App (1), i18n (17), ResultModal (13), DuckMoodLogo (7), ShortenForm (24), QuackCounter (40), StatsView (19), Home (5), Home-extended (18). All pass.
- The i18n suite (`i18n.test.tsx`) covers: default locale, nested key resolution, missing key (returns raw key), object-resolves-to-key guard, `{{param}}` substitution (string + numeric + multi-param), provider-throws-outside-context, locale switching, persistence (`localStorage`), initial load from `localStorage`, English fallback, and invalid-`localStorage`-value handling.

### 4. Review Correction Log

A follow-up audit (2026-06-28) caught two inaccuracies in the original review's sign-off that are now corrected in the codebase:

| Original claim | Status | Action |
|---|---|---|
| "All 144 unit tests pass" | **Accurate** — re-verified; the frontend suite is exactly 144 tests. (An initial re-count using a flat `it(`/`test(` grep undercounted by missing `QuackCounter.test.tsx`, but the Vitest reporter confirms 144.) | No change; documented here to close the loop. |
| "100% Thai translation coverage" | **Inaccurate** — `lang-en.json` had 127 leaf keys vs `lang-th.json`'s 49. 78 were missing: 77 dead/legacy keys (`urlShortenerForm.*`, top-level `modal.*`, `admin.*`) unreferenced by any component, plus 1 live gap (`devModeBar.text`, dev-only). | Removed the 77 dead keys from `lang-en.json`; added `devModeBar.text` to `lang-th.json`. EN/TH are now structurally 1:1 at 50 keys each, making the "100%" claim genuinely true. |
| `home.shortenForm.errors.invalidCustomId` EN copy said "3-50 characters" | `CUSTOM_ID_REGEX` actually enforces `{3,20}` | Corrected EN string to "3-20 characters" (TH was already correct). |

The i18n fallback test previously relied on the dead `urlShortenerForm.label` key as its "English-only" fixture; after the dead keys were removed it was rewritten to use a key absent from both dictionaries, exercising the terminal raw-key fallback branch instead.
