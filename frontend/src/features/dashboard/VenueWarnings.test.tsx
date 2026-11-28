import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { VenueWarnings } from './VenueWarnings.tsx'

describe('the venue’s warnings (#19)', () => {
  it('says so when there is nothing to review', () => {
    render(
      <MemoryRouter>
        <VenueWarnings warnings={[]} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Warnings' })).toBeVisible()
    expect(screen.getByText(/every confirmed guest has a seat/)).toBeVisible()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('counts and lists them, with each one’s help and action', () => {
    render(
      <MemoryRouter>
        <VenueWarnings
          warnings={[
            {
              id: 'tables',
              tone: 'danger',
              icon: Users,
              title: 'Tables over capacity: 1',
              lines: ['Table 15 is over its capacity by 2.'],
              help: 'Add chairs.',
              action: { label: 'Open Event Layout', to: '/x', icon: null },
            },
            {
              id: 'seats',
              tone: 'info',
              icon: Users,
              title: 'Without a table',
              lines: ['32 people.'],
            },
          ]}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('2 to review')).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Add chairs.')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Open Event Layout' }),
    ).toHaveAttribute('href', '/x')
  })
})
