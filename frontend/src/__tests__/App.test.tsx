import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  )
}

describe('App routing', () => {
  it('renders 404 page for unknown routes', () => {
    renderWithRouter('/does-not-exist')
    expect(screen.getByText('404')).toBeInTheDocument()
  })
})
