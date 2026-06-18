import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../lib/i18n'
import App from '../App'

function renderWithRouter(initialPath: string) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </I18nProvider>
  )
}

describe('App routing', () => {
  it('renders 404 page for unknown routes', () => {
    renderWithRouter('/does-not-exist')
    expect(screen.getByText('404')).toBeInTheDocument()
  })
})
