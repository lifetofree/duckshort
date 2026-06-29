# Tech Stack: Additional Locales (Thai)

This document outlines the technical feasibility, stack selection, and coding standards for the localization system.

## Feasibility Study
- **Technical Risk**: Extremely low. The codebase already contains a lightweight, custom `I18nProvider` and a dot-notation text resolver.
- **Dependency Impact**: Zero new dependencies. We will NOT add `react-i18next` or `i18next`, adhering to the strict bundle size limits (Wave 2.3 and 7.4 constraints: entry <= 250 KB, chunks <= 150 KB). All code is native React 18 Context API.

## Stack Selection
1. **State Management**: React Context (`I18nContext`) to propagate the active locale state ('en' or 'th') and switcher function (`setLocale`).
2. **Translation Storage**: Static JSON files at `frontend/src/locales/lang-en.json` and `frontend/src/locales/lang-th.json`.
3. **Persistence**: Synchronous `localStorage` checks on provider initialization.

## Coding Conventions
- **Strict Typing**: The `locale` must be typed as `type Locale = 'en' | 'th'`.
- **Validation**: Any value retrieved from `localStorage` must be validated against `Locale` values before setting the state.
- **Language Switcher UI**: Must be styled using CSS variables (like `--neon-cyan`, `--neon-purple`, `--bg-tertiary`) for theme coherence, ensuring consistency with the "Neon Pond" aesthetic.

## Security Baseline
- Ensure that the locale string cannot be used to perform prototype pollution or arbitrary key accesses. The `getNestedValue` helper must safely check properties (e.g. using `key in current` and avoiding prototype properties).
