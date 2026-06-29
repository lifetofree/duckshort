# Requirements: Additional Locales (Thai)

This document details the functional specifications and acceptance criteria for multi-language support (English and Thai).

## Functional Specifications

1. **Locale File**:
   - Create a JSON translation file for Thai at `frontend/src/locales/lang-th.json` with the exact structure matching `lang-en.json`.

2. **I18n Provider Integration**:
   - Extend `I18nProvider` and the context to expose:
     - `locale`: The currently active locale ('en' or 'th').
     - `setLocale`: A function to change the active locale.
     - `t`: The translation function resolving strings dynamically based on the active `locale`.
   - The default locale must be `en`.
   - On initialization, it should load the preferred language from `localStorage` (`duckshort_locale`). If not set, it should default to `en`.

3. **Locale Switcher Component**:
   - A language switcher UI must be added to the top-right of the Home page.
   - It should let the user select between "English" (EN) and "ไทย" (TH).
   - Selection should feel premium, matching the "Neon Pond" aesthetic (using neon borders, hover states, and smooth transition animations).
   - The selected locale must be written to `localStorage` under the key `duckshort_locale`.

## Acceptance Criteria

### AC-1: Translation Coverage
- When the Thai locale is active, all text on the Home page (title, tagline, shorten form inputs, options, labels, quack counter, status messages, stats view labels, and footer) must be rendered in Thai.

### AC-2: State Persistence
- Selecting Thai, refreshing the browser, and returning to the page must keep Thai as the active locale.
- Selecting English, refreshing the browser, and returning to the page must keep English as the active locale.

### AC-3: Instant Switching (SPA Behavior)
- Switching the language must immediately update the translated strings on screen without a full browser reload.

### AC-4: Fallback Behavior
- If a key is missing in the Thai translation, it should fall back to English before falling back to the raw key string.
