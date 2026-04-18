/**
 * Unit tests for the i18n system (I18nProvider + useTranslation hook).
 * Tests key resolution, param substitution, and error handling.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { render, renderHook } from '@testing-library/react'
import { I18nProvider, useTranslation } from '../lib/i18n'

// Helper component to exercise useTranslation
function TKey({ k, params }: { k: string; params?: Record<string, string | number> }) {
  const { t } = useTranslation()
  return <span data-testid="output">{t(k, params)}</span>
}

function renderKey(key: string, params?: Record<string, string | number>) {
  return render(
    <I18nProvider>
      <TKey k={key} params={params} />
    </I18nProvider>
  )
}

describe('useTranslation — key resolution', () => {
  it('resolves a top-level string key', () => {
    renderKey('common.loading')
    expect(screen.getByTestId('output').textContent).not.toBe('common.loading')
    expect(screen.getByTestId('output').textContent?.length).toBeGreaterThan(0)
  })

  it('resolves a deeply nested key using dot notation', () => {
    renderKey('home.shortenForm.button')
    const text = screen.getByTestId('output').textContent
    expect(text).not.toBe('home.shortenForm.button')
    expect(text?.length).toBeGreaterThan(0)
  })

  it('returns the key itself when the key is missing', () => {
    renderKey('does.not.exist')
    expect(screen.getByTestId('output').textContent).toBe('does.not.exist')
  })

  it('returns the key when it resolves to an object, not a string', () => {
    // 'home' alone is an object, not a leaf string
    renderKey('home')
    expect(screen.getByTestId('output').textContent).toBe('home')
  })
})

describe('useTranslation — param substitution', () => {
  it('replaces {{version}} placeholder in footer key', () => {
    renderKey('home.footer', { version: '1.3.0' })
    const text = screen.getByTestId('output').textContent
    expect(text).toContain('1.3.0')
    expect(text).not.toContain('{{version}}')
  })

  it('leaves unmatched {{param}} placeholders intact when param missing', () => {
    renderKey('home.footer') // no params provided
    const text = screen.getByTestId('output').textContent
    // {{version}} is NOT replaced — stays as-is
    expect(text).toContain('{{version}}')
  })

  it('replaces {{param}} with numeric value', () => {
    renderKey('home.shortenForm.errors.failedToShorten', { status: 500 })
    const text = screen.getByTestId('output').textContent
    expect(text).toContain('500')
  })

  it('handles multiple params', () => {
    // test that multiple {{x}} replacements work if such a key existed
    // We verify the mechanism by using the footer key with extra ignored params
    renderKey('home.footer', { version: '2.0.0', extra: 'ignored' })
    expect(screen.getByTestId('output').textContent).toContain('2.0.0')
  })
})

describe('useTranslation — throws outside provider', () => {
  it('the hook throws when context is undefined', () => {
    // Verify the error message constant is correct without triggering
    // the React async window error that leaks into other test files.
    const { result } = renderHook(() => {
      try {
        return useTranslation()
      } catch (e) {
        return { error: (e as Error).message }
      }
    })
    expect(result.current).toEqual({ error: 'useTranslation must be used within an I18nProvider' })
  })
})

describe('I18nProvider', () => {
  it('renders children correctly', () => {
    render(
      <I18nProvider>
        <div data-testid="child">hello</div>
      </I18nProvider>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('provides consistent translations to nested components', () => {
    function Parent() {
      const { t } = useTranslation()
      return <span>{t('common.loading')}</span>
    }
    function Child() {
      const { t } = useTranslation()
      return <span>{t('common.copied')}</span>
    }

    render(
      <I18nProvider>
        <Parent />
        <Child />
      </I18nProvider>
    )

    // Both should resolve to non-key strings
    const spans = document.querySelectorAll('span')
    expect(spans[0].textContent).not.toBe('common.loading')
    expect(spans[1].textContent).not.toBe('common.copied')
  })
})
