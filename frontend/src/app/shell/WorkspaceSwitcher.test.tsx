import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { VenueWorkspace } from '../../services/contracts/index.ts'
import { WorkspaceSwitcher } from './WorkspaceSwitcher.tsx'

const workspaces: VenueWorkspace[] = [
  {
    organization: {
      id: 'org-1',
      name: 'Grand Garden Hall',
      defaultLanguage: 'en',
      contactEmail: null,
      contactPhone: null,
    },
    role: 'VENUE_OWNER',
  },
]

function renderSwitcher() {
  render(
    <MemoryRouter>
      <WorkspaceSwitcher
        currentVenueId={null}
        workspaces={workspaces}
        onNavigate={() => undefined}
      />
      <a href="/elsewhere">Elsewhere</a>
    </MemoryRouter>,
  )
  return screen.getByRole('button', { name: /^Workspace: Personal/ })
}

const list = () => screen.queryByText('Switch workspace')

describe('the workspace switcher', () => {
  it('opens and closes with its own button', () => {
    const button = renderSwitcher()
    expect(list()).not.toBeVisible()

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(list()).toBeVisible()

    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(list()).not.toBeVisible()
  })

  it('closes on a click or focus outside it, and with Escape', () => {
    const button = renderSwitcher()
    const outside = screen.getByRole('link', { name: 'Elsewhere' })

    fireEvent.click(button)
    fireEvent.pointerDown(outside)
    expect(list()).not.toBeVisible()

    fireEvent.click(button)
    fireEvent.focusIn(outside)
    expect(list()).not.toBeVisible()

    fireEvent.click(button)
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(list()).not.toBeVisible()
  })

  it('stays open for a click inside its list', () => {
    const button = renderSwitcher()
    fireEvent.click(button)
    fireEvent.pointerDown(screen.getByText('Switch workspace'))
    expect(list()).toBeVisible()
  })

  it('is not shown to someone with no venue', () => {
    render(
      <MemoryRouter>
        <WorkspaceSwitcher
          currentVenueId={null}
          workspaces={[]}
          onNavigate={() => undefined}
        />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
})
