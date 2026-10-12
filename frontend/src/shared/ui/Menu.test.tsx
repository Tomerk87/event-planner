import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import {
  coverVariant,
  COVER_ICONS,
  COVER_PALETTES,
} from './eventCoverVariant.ts'
import { EventCover } from './EventCover.tsx'
import { Menu } from './Menu.tsx'

function renderMenu(onSelect = vi.fn()) {
  render(
    <MemoryRouter>
      <Menu
        label="Actions"
        items={[
          { id: 'open', label: 'Open', to: '/somewhere' },
          { id: 'copy', label: 'Copy', onSelect },
          { id: 'delete', label: 'Delete', tone: 'danger', onSelect },
        ]}
      >
        More
      </Menu>
      <button type="button">Outside</button>
    </MemoryRouter>,
  )
  return {
    onSelect,
    trigger: screen.getByRole('button', { name: 'Actions' }),
  }
}

function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
  return screen.getByRole('menu', { name: 'Actions' })
}

describe('Menu', () => {
  it('is closed until its button is used, then focuses the first action', () => {
    const { trigger } = renderMenu()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    open()

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveAttribute(
      'href',
      '/somewhere',
    )
  })

  it('moves between actions with the arrow keys, Home and End', () => {
    renderMenu()
    const menu = open()
    const focused = () => document.activeElement?.textContent

    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(focused()).toBe('Copy')
    fireEvent.keyDown(menu, { key: 'End' })
    expect(focused()).toBe('Delete')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(focused()).toBe('Open')
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(focused()).toBe('Delete')
    fireEvent.keyDown(menu, { key: 'Home' })
    expect(focused()).toBe('Open')
    fireEvent.keyDown(menu, { key: 'a' })
    expect(focused()).toBe('Open')
  })

  it('runs an action, closes and returns focus to the button', () => {
    const { onSelect, trigger } = renderMenu()
    open()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on Escape, returning focus, and ignores keys while closed', () => {
    const { trigger } = renderMenu()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.keyDown(open(), { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes when a link is followed, the button is used again, or focus leaves', () => {
    renderMenu()

    open()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    open()
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    open()
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Copy' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    open()
    fireEvent.focusIn(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('EventCover', () => {
  it('gives an event the same cover every time, within the available variants', () => {
    for (const id of ['evt-1', 'evt-2', 'evt-n14', '', 'אירוע']) {
      const variant = coverVariant(id)
      expect(coverVariant(id)).toEqual(variant)
      expect(variant.palette).toBeGreaterThanOrEqual(0)
      expect(variant.palette).toBeLessThan(COVER_PALETTES)
      expect(variant.icon).toBeGreaterThanOrEqual(0)
      expect(variant.icon).toBeLessThan(COVER_ICONS)
    }
  })

  it('varies across the demo events', () => {
    const variants = ['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5', 'evt-6'].map(
      (id) => JSON.stringify(coverVariant(id)),
    )
    expect(new Set(variants).size).toBeGreaterThanOrEqual(3)
  })

  it('is decorative', () => {
    const { container } = render(<EventCover eventId="evt-1" size="thumb" />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
