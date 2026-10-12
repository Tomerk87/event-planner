import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { EventAccess } from '../../domain/access.ts'
import { EditGate, ReadOnlyBadge, ReadOnlyNotice } from './EventAccess.tsx'
import { EventAccessContext } from './eventAccessContext.ts'

function renderWithAccess(access: EventAccess | null, ui: ReactNode) {
  return render(
    <EventAccessContext.Provider value={access}>
      {ui}
    </EventAccessContext.Provider>,
  )
}

const controls = (
  <>
    <ReadOnlyNotice />
    <ReadOnlyBadge />
    <EditGate fallback={<p>No editing</p>}>
      <button type="button">Add Guest</button>
    </EditGate>
  </>
)

describe('read-only primitives', () => {
  it.each(['OWNER', 'ADMIN'] as const)(
    'shows editing controls and no notice to %s of an active event',
    (role) => {
      renderWithAccess({ role, isPastEvent: false }, controls)

      expect(
        screen.getByRole('button', { name: 'Add Guest' }),
      ).toBeInTheDocument()
      expect(screen.queryByText('View-only access')).not.toBeInTheDocument()
      expect(screen.queryByText('This event has ended')).not.toBeInTheDocument()
    },
  )

  it('hides editing controls from a Viewer and explains why', () => {
    renderWithAccess({ role: 'VIEWER', isPastEvent: false }, controls)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('No editing')).toBeInTheDocument()
    expect(screen.getAllByText('View-only access')).toHaveLength(2)
    expect(screen.getByText(/download exports/)).toBeInTheDocument()
  })

  it('hides editing controls on a past event even from an Owner', () => {
    renderWithAccess({ role: 'OWNER', isPastEvent: true }, controls)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getAllByText('This event has ended')).toHaveLength(2)
  })

  it('shows the past-event reason rather than the Viewer reason when both apply', () => {
    renderWithAccess({ role: 'VIEWER', isPastEvent: true }, controls)

    expect(screen.getAllByText('This event has ended')).toHaveLength(2)
    expect(screen.queryByText('View-only access')).not.toBeInTheDocument()
  })

  it('hides editing controls when there is no event access at all', () => {
    renderWithAccess(null, controls)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('No editing')).toBeInTheDocument()
  })
})
