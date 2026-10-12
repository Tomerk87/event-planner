import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../test/matchMedia.ts'
import { Avatar } from './Avatar.tsx'
import { Badge } from './Badge.tsx'
import { BottomActionBar } from './BottomActionBar.tsx'
import { Button, IconButton } from './Button.tsx'
import { ButtonLink } from './ButtonLink.tsx'
import { Card, KpiCard, KpiGrid } from './Card.tsx'
import { DataTable } from './DataTable.tsx'
import { Dialog, Drawer } from './Dialog.tsx'
import { SelectField, TextArea, TextField } from './Field.tsx'
import { LtrText } from './LtrText.tsx'
import { Notice } from './Notice.tsx'
import { PageHeader } from './PageHeader.tsx'
import { RoleIcon } from './RoleIcon.tsx'
import { EmptyState, ErrorState, LoadingState } from './States.tsx'
import { Tabs } from './Tabs.tsx'
import { useToast } from './toastContext.ts'
import { ToastProvider } from './ToastProvider.tsx'

describe('Button', () => {
  it('is a non-submitting button by default and reports clicks', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(button)

    expect(button).toHaveAttribute('type', 'button')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and marked busy while loading', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(button)

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('gives an icon-only button an accessible name', () => {
    render(
      <IconButton label="Add guest">
        <Plus />
      </IconButton>,
    )

    expect(
      screen.getByRole('button', { name: 'Add guest' }),
    ).toBeInTheDocument()
  })
})

describe('form fields', () => {
  it('associates the label, hint and error with the input', () => {
    render(
      <TextField
        label="Maximum Attendees"
        hint="Allowed range: 50 – 3000."
        error="Enter a number between 50 and 3000."
        required
      />,
    )

    const input = screen.getByRole('textbox', { name: /Maximum Attendees/ })

    expect(input).toBeRequired()
    expect(input).toBeInvalid()
    expect(input).toHaveAccessibleDescription(
      'Allowed range: 50 – 3000. Enter a number between 50 and 3000.',
    )
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
  })

  it('is valid and undescribed without a hint or error', () => {
    render(<TextField label="Event Name" />)

    const input = screen.getByRole('textbox', { name: 'Event Name' })

    expect(input).toBeValid()
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('keeps a hidden label available to assistive technology', () => {
    render(<TextField label="Search guests" hideLabel />)

    expect(
      screen.getByRole('textbox', { name: 'Search guests' }),
    ).toBeInTheDocument()
  })

  it('shows the character count of a limited text area', () => {
    render(
      <TextArea
        label="Welcome Message"
        value="Hello"
        maxLength={500}
        onChange={() => undefined}
      />,
    )

    expect(screen.getByText('5/500')).toBeInTheDocument()
  })

  it('labels a select and reports changes', () => {
    const onChange = vi.fn()
    render(
      <SelectField label="RSVP Language" defaultValue="en" onChange={onChange}>
        <option value="en">English</option>
        <option value="he">עברית</option>
      </SelectField>,
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'RSVP Language' }), {
      target: { value: 'he' },
    })

    expect(onChange).toHaveBeenCalledOnce()
  })
})

describe('Tabs', () => {
  const tabs = [
    { id: 'one', label: 'One', panel: <p>Panel one</p> },
    { id: 'two', label: 'Two', disabled: true, badge: 'Soon' },
    { id: 'three', label: 'Three', panel: <p>Panel three</p> },
  ]

  function selectedTab() {
    return screen.getByRole('tab', { selected: true })
  }

  it('shows the first panel and switches on click', () => {
    const onChange = vi.fn()
    render(<Tabs label="Views" tabs={tabs} onChange={onChange} />)
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel one')

    fireEvent.click(screen.getByRole('tab', { name: 'Three' }))

    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel three')
    expect(onChange).toHaveBeenCalledWith('three')
  })

  it('cannot select a disabled tab', () => {
    render(<Tabs label="Views" tabs={tabs} />)
    const disabled = screen.getByRole('tab', { name: /Two/ })

    fireEvent.click(disabled)

    expect(disabled).toBeDisabled()
    expect(disabled).toHaveTextContent('Soon')
    expect(selectedTab()).toHaveTextContent('One')
  })

  it('moves with the arrow keys, skipping disabled tabs and wrapping', () => {
    render(<Tabs label="Views" tabs={tabs} />)
    const list = screen.getByRole('tablist', { name: 'Views' })

    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(selectedTab()).toHaveTextContent('Three')
    expect(selectedTab()).toHaveFocus()

    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(selectedTab()).toHaveTextContent('One')

    fireEvent.keyDown(list, { key: 'End' })
    expect(selectedTab()).toHaveTextContent('Three')

    fireEvent.keyDown(list, { key: 'Home' })
    expect(selectedTab()).toHaveTextContent('One')
  })

  it('reverses the arrow keys in a right-to-left layout', () => {
    render(
      <div dir="rtl">
        <Tabs label="Views" tabs={tabs} />
      </div>,
    )
    const list = screen.getByRole('tablist')

    fireEvent.keyDown(list, { key: 'ArrowLeft' })

    expect(selectedTab()).toHaveTextContent('Three')
  })

  it('only the selected tab is in the tab order', () => {
    render(<Tabs label="Views" tabs={tabs} />)

    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
      'tabindex',
      '0',
    )
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })
})

describe('Dialog', () => {
  function Harness({ onClosed }: { onClosed?: () => void }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Dialog
          open={open}
          onClose={() => {
            onClosed?.()
            setOpen(false)
          }}
          title="Delete table?"
          footer={<Button onClick={() => setOpen(false)}>Confirm</Button>}
        >
          Guests are not deleted.
        </Dialog>
      </>
    )
  }

  it('reports a close exactly once from the close button', () => {
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClosed).toHaveBeenCalledOnce()
  })

  it('reports a close exactly once from the backdrop', () => {
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    fireEvent.click(screen.getByRole('dialog'))

    expect(onClosed).toHaveBeenCalledOnce()
  })

  it('reports a close exactly once when the browser closes it (Escape)', () => {
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    act(() => screen.getByRole<HTMLDialogElement>('dialog').close())

    expect(onClosed).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not report a close when the parent closes it', () => {
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('can be reopened after closing', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(
      screen.getByRole('dialog', { name: 'Delete table?' }),
    ).toBeInTheDocument()
  })

  it('renders a drawer with the same behaviour', () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose} title="Filters">
        More filters
      </Drawer>,
    )

    expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveTextContent(
      'More filters',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders nothing until opened, then is labelled by its title', () => {
    render(<Harness />)
    expect(
      screen.queryByText('Guests are not deleted.'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(
      screen.getByRole('dialog', { name: 'Delete table?' }),
    ).toHaveTextContent('Guests are not deleted.')
  })

  it('closes from the close button', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked but not when the content is', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.click(screen.getByText('Guests are not deleted.'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(dialog)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('toasts', () => {
  function Trigger({ tone }: { tone: 'success' | 'danger' }) {
    const { showToast } = useToast()
    return (
      <Button onClick={() => showToast({ tone, message: 'Changes saved.' })}>
        Show
      </Button>
    )
  }

  it('announces a toast and removes it when dismissed', () => {
    render(
      <ToastProvider>
        <Trigger tone="success" />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByRole('status')).toHaveTextContent('Changes saved.')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('announces an error toast as an alert', () => {
    render(
      <ToastProvider>
        <Trigger tone="danger" />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Changes saved.')
  })

  it('keeps an error toast until it is dismissed', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <Trigger tone="danger" />
        </ToastProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Show' }))

      act(() => {
        vi.advanceTimersByTime(60_000)
      })
      expect(screen.getByRole('alert')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('removes a success toast by itself after five seconds', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <Trigger tone="success" />
        </ToastProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Show' }))

      act(() => {
        vi.advanceTimersByTime(4999)
      })
      expect(screen.getByRole('status')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails clearly when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Trigger tone="success" />)).toThrow(
      'useToast must be used inside a ToastProvider',
    )
  })
})

describe('Notice', () => {
  it('is not a live region unless asked to announce', () => {
    render(<Notice title="Heads up">Body</Notice>)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Heads up')).toBeInTheDocument()
  })

  it('announces a danger notice as an alert and others as status', () => {
    render(
      <>
        <Notice tone="danger" title="Over capacity" announce />
        <Notice tone="success" title="Saved" announce />
      </>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Over capacity')
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })
})

describe('DataTable', () => {
  const rows = [
    { id: 'a', name: 'Jordan Reed', allowed: 5 },
    { id: 'b', name: 'Sam Carter', allowed: 4 },
  ]

  function renderTable() {
    return render(
      <DataTable
        caption="Guests"
        columns={[
          { id: 'name', header: 'Name', cell: (row) => row.name },
          {
            id: 'allowed',
            header: 'Allowed',
            cell: (row) => row.allowed,
            align: 'end',
          },
        ]}
        rows={rows}
        getRowKey={(row) => row.id}
        renderCard={(row) => <p>{`Card ${row.name}`}</p>}
      />,
    )
  }

  it('renders a captioned table, and no cards, on a wide screen', () => {
    renderTable()

    const table = screen.getByRole('table', { name: 'Guests' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Name', 'Allowed'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(
      within(table).getByRole('cell', { name: 'Sam Carter' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders cards, and no table, on a phone', () => {
    setViewportWidth(400)
    renderTable()

    const list = screen.getByRole('list', { name: 'Guests' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(list).getByText('Card Jordan Reed')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('switches presentation when the screen is resized', () => {
    renderTable()
    expect(screen.getByRole('table')).toBeInTheDocument()

    act(() => setViewportWidth(767))
    expect(screen.getByRole('list')).toBeInTheDocument()

    act(() => setViewportWidth(768))
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

describe('state components', () => {
  it('announces loading with a default label', () => {
    render(<LoadingState />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('offers a retry action on an error', () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('has no retry button without a handler', () => {
    render(<ErrorState />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('LtrText', () => {
  it('isolates a left-to-right value inside right-to-left text', () => {
    render(
      <p dir="rtl">
        טלפון <LtrText>+972 00-000-0001</LtrText>
      </p>,
    )

    expect(screen.getByText('+972 00-000-0001')).toHaveAttribute('dir', 'ltr')
  })
})

describe('cards and badges', () => {
  it('renders a titled card as a section with its actions', () => {
    render(
      <Card title="Tables" subtitle="All tables" actions={<button>Add</button>}>
        <p>Body</p>
      </Card>,
    )

    expect(
      screen.getByRole('heading', { level: 2, name: 'Tables' }),
    ).toBeInTheDocument()
    expect(screen.getByText('All tables')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('renders an untitled card without a heading', () => {
    render(
      <Card>
        <p>Body</p>
      </Card>,
    )

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('groups KPI cards under a label and shows each label and value', () => {
    render(
      <KpiGrid label="Summary">
        <KpiCard label="Total Guests" value="1,640" icon={<Plus />} />
        <KpiCard label="Declined" value={43} icon={<Plus />} tone="danger" />
      </KpiGrid>,
    )

    const group = screen.getByRole('region', { name: 'Summary' })
    expect(within(group).getByText('Total Guests')).toBeInTheDocument()
    expect(within(group).getByText('1,640')).toBeInTheDocument()
    expect(within(group).getByText('43')).toBeInTheDocument()
  })

  it('shows badge text and hides its icon from assistive technology', () => {
    render(
      <Badge tone="success" icon={<Plus data-testid="badge-icon" />}>
        Approved
      </Badge>,
    )

    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByTestId('badge-icon').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })
})

describe('PageHeader', () => {
  it('renders the page heading, subtitle and actions, and sets the tab title', () => {
    render(
      <PageHeader
        title="Guests"
        subtitle="Manage your guest list."
        actions={<button>Add Guest</button>}
      />,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Guests' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Manage your guest list.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add Guest' }),
    ).toBeInTheDocument()
    expect(document.title).toBe('Guests · Event Planner')
  })
})

describe('Avatar', () => {
  it.each([
    ['Alex Morgan', 'AM'],
    ['alex', 'A'],
    ['  Noa  Ben  David ', 'ND'],
    ['דנה לוי', 'דל'],
  ])('shows initials for %j', (name, initials) => {
    const { container } = render(<Avatar name={name} />)

    expect(container.firstElementChild).toHaveTextContent(
      new RegExp(`^${initials}$`),
    )
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows nothing for an empty name', () => {
    const { container } = render(<Avatar name="" />)

    expect(container.firstElementChild).toBeEmptyDOMElement()
  })
})

describe('ButtonLink', () => {
  it('is a link to its destination', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/" icon={<Plus />}>
          Back to My Events
        </ButtonLink>
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', { name: 'Back to My Events' }),
    ).toHaveAttribute('href', '/')
  })
})

describe('RoleIcon', () => {
  it('renders a different decorative icon for each role', () => {
    const { container } = render(
      <>
        <RoleIcon role="OWNER" />
        <RoleIcon role="ADMIN" />
        <RoleIcon role="VIEWER" />
      </>,
    )
    const icons = [...container.querySelectorAll('svg')]

    expect(icons).toHaveLength(3)
    expect(new Set(icons.map((icon) => icon.innerHTML)).size).toBe(3)
    for (const icon of icons) {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    }
  })
})

describe('EmptyState', () => {
  it('shows its title, description and action', () => {
    render(
      <EmptyState
        icon={<Plus />}
        title="No guests yet"
        description="Add your first guest."
        action={<button>Add Guest</button>}
      />,
    )

    expect(screen.getByText('No guests yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first guest.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add Guest' }),
    ).toBeInTheDocument()
  })
})

describe('BottomActionBar', () => {
  it('is a labelled region holding its actions', () => {
    render(
      <BottomActionBar label="Page actions">
        <button>Preview</button>
        <button>Save Changes</button>
      </BottomActionBar>,
    )

    const bar = screen.getByRole('region', { name: 'Page actions' })
    expect(
      within(bar)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Preview', 'Save Changes'])
  })

  it('comes after the page content in the document, so focus reaches it last', () => {
    render(
      <>
        <BottomActionBar label="Page actions">
          <button>Save Changes</button>
        </BottomActionBar>
        <input aria-label="Event Name" />
      </>,
    )

    const field = screen.getByRole('textbox', { name: 'Event Name' })
    const save = screen.getByRole('button', { name: 'Save Changes' })
    expect(
      field.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('reserves space at the end of the page while shown and releases it when removed', () => {
    const root = document.documentElement
    expect(root.style.getPropertyValue('--action-bar-space')).toBe('')

    const { unmount } = render(
      <BottomActionBar label="Page actions">
        <button>Save Changes</button>
      </BottomActionBar>,
    )
    expect(root.style.getPropertyValue('--action-bar-space')).toMatch(/px$/)

    unmount()
    expect(root.style.getPropertyValue('--action-bar-space')).toBe('')
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})

describe('PageHeader actions placement', () => {
  function Header({ compactActions }: { compactActions?: 'inline' | 'bar' }) {
    return (
      <PageHeader
        title="Event Settings"
        compactActions={compactActions}
        actions={<button>Save Changes</button>}
      />
    )
  }

  it('keeps actions in the header at desktop width', () => {
    render(<Header compactActions="bar" />)

    expect(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Save Changes',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('moves actions into the bottom bar below desktop width', () => {
    setViewportWidth(1023)
    render(<Header compactActions="bar" />)

    const bar = screen.getByRole('region', { name: 'Page actions' })
    expect(
      within(bar).getByRole('button', { name: 'Save Changes' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('banner')).queryByRole('button'),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('moves actions between the header and the bar when the width changes', () => {
    render(<Header compactActions="bar" />)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()

    act(() => setViewportWidth(400))
    expect(screen.getByRole('region')).toBeInTheDocument()

    act(() => setViewportWidth(1024))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(
      document.documentElement.style.getPropertyValue('--action-bar-space'),
    ).toBe('')
  })

  it('keeps actions under the title on a phone by default', () => {
    setViewportWidth(400)
    render(<Header />)

    expect(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Save Changes',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('renders no bar when there are no actions', () => {
    setViewportWidth(400)
    render(<PageHeader title="Guests" compactActions="bar" />)

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
