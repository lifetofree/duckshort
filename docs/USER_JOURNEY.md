# User Journey: Locale Selection

This document maps the user interaction steps for discovering, changing, and verifying the application language.

## Journey: Switching Language from English to Thai

### 1. Discovery
- **User Action**: The user lands on the Home page (defaulting to English or their last-selected language).
- **System Presentation**: The app renders all text in English. In the top-right corner of the viewport, a sleek, neon-bordered button/selector labeled `EN / TH` or `English / ไทย` is visible.
- **Visuals**: The switcher features a subtle cyan glow on hover to invite interaction.

### 2. Selection
- **User Action**: The user clicks the `TH` button.
- **System Action**: 
  - Immediately updates the active `locale` state to `'th'`.
  - Saves the preference: `localStorage.setItem('duckshort_locale', 'th')`.
  - Re-evaluates all calls to `translate()`.
- **System Presentation**: All text elements (headers, tabs, inputs, buttons, footer) instantly transition to Thai. The switcher highlights `TH` with a neon purple or magenta border and dim `EN`.

### 3. Verification & Persistence
- **User Action**: The user refreshes the page or returns later.
- **System Action**:
  - On mount, `I18nProvider` reads `localStorage.getItem('duckshort_locale')`.
  - Resolves `th` as the active locale.
- **System Presentation**: The page immediately renders in Thai on load. No layout shift or flashes of English text should occur.
