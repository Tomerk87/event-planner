import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PlaceSuggester } from '../places.ts'
import { PlaceField } from './PlaceField.tsx'

function stubSuggester(
  suggest: PlaceSuggester['suggest'] = async (input) => [
    {
      text: `${input} Hall, Herzl St, Tel Aviv-Yafo, Israel`,
      main: `${input} Hall`,
      secondary: 'Herzl St, Tel Aviv-Yafo, Israel',
    },
    {
      text: `${input} Garden, Haifa, Israel`,
      main: `${input} Garden`,
      secondary: 'Haifa, Israel',
    },
  ],
): PlaceSuggester & { suggest: ReturnType<typeof vi.fn> } {
  return {
    newSession: vi.fn(async () => ({ session: true })),
    suggest: vi.fn(suggest),
  }
}

function Location({ suggester }: { suggester: PlaceSuggester | null }) {
  const [value, setValue] = useState('')
  return (
    <>
      <PlaceField
        label="Location"
        value={value}
        country="BR"
        suggester={suggester}
        onChange={setValue}
      />
      <output>{value}</output>
    </>
  )
}

describe('PlaceField (D104)', () => {
  it('is a plain text field without a suggester', () => {
    render(<Location suggester={null} />)

    const field = screen.getByRole('textbox', { name: 'Location' })
    fireEvent.change(field, { target: { value: 'The Old Mill' } })

    expect(screen.getByRole('status')).toHaveTextContent('The Old Mill')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('suggests places after a pause, and fills the field with the chosen one', async () => {
    const suggester = stubSuggester()
    render(<Location suggester={suggester} />)
    const field = screen.getByRole('combobox', { name: 'Location' })

    fireEvent.change(field, { target: { value: 'Ro' } })
    fireEvent.change(field, { target: { value: 'Rose' } })

    expect(
      await screen.findByRole('option', { name: /Rose Hall/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Google Maps')).toBeInTheDocument()
    // Asked once, for the text after the pause, favouring the event's country.
    expect(suggester.suggest).toHaveBeenCalledTimes(1)
    expect(suggester.suggest).toHaveBeenCalledWith('Rose', {
      language: 'en',
      country: 'BR',
      session: { session: true },
    })

    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'Enter' })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Rose Garden, Haifa, Israel',
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('keeps what was typed when nothing is chosen, and closes on Escape', async () => {
    render(<Location suggester={stubSuggester()} />)
    const field = screen.getByRole('combobox', { name: 'Location' })

    fireEvent.change(field, { target: { value: 'My backyard' } })
    await screen.findByRole('listbox')
    fireEvent.keyDown(field, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('My backyard')
  })

  it('still works when suggestions cannot be fetched', async () => {
    const suggester = stubSuggester(async () => {
      throw new Error('quota')
    })
    render(<Location suggester={suggester} />)
    const field = screen.getByRole('combobox', { name: 'Location' })

    fireEvent.change(field, { target: { value: 'Rose' } })

    await waitFor(() => expect(suggester.suggest).toHaveBeenCalled())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Rose')
  })
})
