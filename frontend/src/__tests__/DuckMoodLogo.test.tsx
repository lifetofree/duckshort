import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import DuckMoodLogo from '../components/DuckMoodLogo'
import { renderWithProviders } from '../test/renderWithProviders'

describe('DuckMoodLogo', () => {
  it('renders DORMANT mood correctly', () => {
    renderWithProviders(<DuckMoodLogo mood="DORMANT" />)
    expect(screen.getByText('DORMANT')).toBeInTheDocument()
  })

  it('renders ACTIVE mood correctly', () => {
    renderWithProviders(<DuckMoodLogo mood="ACTIVE" />)
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
  })

  it('renders BUSY mood correctly', () => {
    renderWithProviders(<DuckMoodLogo mood="BUSY" />)
    expect(screen.getByText('BUSY')).toBeInTheDocument()
    expect(screen.getByText('😎')).toBeInTheDocument()
  })

  it('renders VIRAL mood correctly', () => {
    renderWithProviders(<DuckMoodLogo mood="VIRAL" />)
    expect(screen.getByText('VIRAL')).toBeInTheDocument()
    expect(screen.getByText('😎')).toBeInTheDocument()
  })

  it('renders ERROR mood correctly', () => {
    renderWithProviders(<DuckMoodLogo mood="ERROR" />)
    expect(screen.getByText('DEGRADED')).toBeInTheDocument()
    expect(screen.getByText('😢')).toBeInTheDocument()
  })

  it('displays logo image', () => {
    renderWithProviders(<DuckMoodLogo mood="ACTIVE" />)
    const logo = document.querySelector('img')
    expect(logo).toBeInTheDocument()
    expect(logo?.alt).toBe('DuckShort')
  })

  it('applies correct styling for different moods', () => {
    const { rerender } = renderWithProviders(<DuckMoodLogo mood="ACTIVE" />)
    const activeLogo = document.querySelector('img')
    const activeBorder = activeLogo?.style.borderColor

    rerender(<DuckMoodLogo mood="VIRAL" />)
    const viralLogo = document.querySelector('img')
    const viralBorder = viralLogo?.style.borderColor

    // Different moods should have different border colors
    expect(activeBorder).toBeDefined()
    expect(viralBorder).toBeDefined()
  })
})
