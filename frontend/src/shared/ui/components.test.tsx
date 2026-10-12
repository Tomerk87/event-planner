import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, IconButton } from './Button.tsx'
import { DataTable } from './DataTable.tsx'
import { Dialog } from './Dialog.tsx'
import { SelectField, TextArea, TextField } from './Field.tsx'
import { LtrText } from './LtrText.tsx'
import { Notice } from './Notice.tsx'
import { ErrorState, LoadingState } from './States.tsx'
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
    expect(screen.getByText('(required)')).toBeInTheDocument()
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
  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Delete table?"
        >
          Guests are not deleted.
        </Dialog>
      </>
    )
  }

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

  it('removes a toast by itself after five seconds', () => {
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

  it('renders the rows as a captioned table and as a card list', () => {
    render(
      <DataTable
        caption="Guests"
        columns={[
          { id: 'name', header: 'Name', cell: (row) => row.name },
          { id: 'allowed', header: 'Allowed', cell: (row) => row.allowed },
        ]}
        rows={rows}
        getRowKey={(row) => row.id}
        renderCard={(row) => <p>{`Card ${row.name}`}</p>}
      />,
    )

    const table = screen.getByRole('table', { name: 'Guests' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Name', 'Allowed'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(
      within(table).getByRole('cell', { name: 'Sam Carter' }),
    ).toBeVisible()

    const list = screen.getByRole('list', { name: 'Guests' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(list).getByText('Card Jordan Reed')).toBeInTheDocument()
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
