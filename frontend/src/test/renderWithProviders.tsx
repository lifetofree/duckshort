import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../lib/i18n'
import type { ReactElement, ReactNode } from 'react'

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </I18nProvider>
  )
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options })
}
