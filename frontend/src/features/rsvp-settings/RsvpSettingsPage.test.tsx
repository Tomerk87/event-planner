import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '../../services/contracts/index.ts'
import { change } from '../../test/controls.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
} from '../../test/renderApp.tsx'
import { drawQr } from './qr.ts'

const MAIN = DEMO_EVENTS.owner

async function openSettings(
  eventId: string = MAIN,
  services: Services = createTestServices(),
) {
  const view = renderApp(`/events/${eventId}/rsvp`, services)
  await screen.findByRole('heading', { name: 'RSVP Content' })
  return view
}

const field = (name: string): HTMLInputElement =>
  screen.getByLabelText(new RegExp(`^${name}`))
const type = (name: string, value: string) =>
  change(field(name), { target: { value } })
const saveButton = () => screen.getByRole('button', { name: 'Save Changes' })
const preview = () =>
  screen.getByRole('group', { name: 'Preview of the public RSVP page' })

async function save() {
  fireEvent.click(saveButton())
  await screen.findByText('RSVP settings saved.')
}

function imageFile(type: string, size = 1000): File {
  const file = new File(['x'], 'picture', { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function choose(file: File) {
  fireEvent.change(screen.getByTestId('background-file'), {
    target: { files: [file] },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('RSVP Settings', () => {
  it('shows the saved settings and the event’s link, with nothing to save yet', async () => {
    const { services } = await openSettings()
    const { event } = await services.events.get(MAIN)
    const settings = await services.rsvp.getSettings(MAIN)

    expect(field('RSVP link')).toHaveValue(
      `${window.location.origin}/rsvp/${event.rsvpSlug}`,
    )
    expect(screen.getByText('RSVP page is active')).toBeInTheDocument()
    expect(field('RSVP Title')).toHaveValue(event.rsvpTitle ?? '')
    expect(field('Welcome Message')).toHaveValue(settings.welcomeMessage)
    expect(field('Image Overlay')).toHaveValue('40')
    expect(field('RSVP Language')).toHaveValue('en')
    expect(saveButton()).toBeDisabled()
    expect(
      screen.getByRole('link', { name: 'Open Public Page' }),
    ).toHaveAttribute('href', `/rsvp/${event.rsvpSlug}`)
    expect(
      screen.getByRole('link', { name: 'Open Public Page' }),
    ).toHaveAttribute('target', '_blank')
  })

  it('shows changes in the preview at once and saves them', async () => {
    const { services } = await openSettings()

    type('Welcome Message', 'Come and dance')
    type('Approved Message', '')
    type('RSVP Title', 'M & D')
    change(field('Image Overlay'), { target: { value: '70' } })

    expect(within(preview()).getByText('Come and dance')).toBeInTheDocument()
    expect(
      within(preview()).getByRole('heading', { name: 'M & D' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Preview reflects unsaved changes'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Approved' }))
    expect(
      within(preview()).getByText(
        'Thank you for confirming! We look forward to seeing you.',
      ),
    ).toBeInTheDocument()
    expect(within(preview()).queryByRole('textbox')).not.toBeInTheDocument()

    await save()

    expect(await services.rsvp.getSettings(MAIN)).toMatchObject({
      welcomeMessage: 'Come and dance',
      approvedMessage: '',
      overlayOpacity: 70,
    })
    expect((await services.events.get(MAIN)).event.rsvpTitle).toBe('M & D')
    await waitFor(() => expect(saveButton()).toBeDisabled())
    expect(
      screen.queryByText('Preview reflects unsaved changes'),
    ).not.toBeInTheDocument()
  })

  it('sets the default RSVP language, and the preview follows it', async () => {
    const { services } = await openSettings()

    type('RSVP Language', 'he')

    expect(
      within(preview()).getByRole('button', { name: 'אגיע!', hidden: true }),
    ).toBeInTheDocument()
    await save()
    expect((await services.events.get(MAIN)).event.rsvpLanguage).toBe('he')
  })

  it('sets up the calendar entry from the event and checks it', async () => {
    const { services } = await openSettings()
    const { event } = await services.events.get(MAIN)

    expect(screen.queryByLabelText(/^Calendar Title/)).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('switch', { name: /Add to Google Calendar/ }),
    )
    expect(field('Calendar Title')).toHaveValue(event.name)
    expect(field('Time')).toHaveValue('18:30')
    expect(field('Location')).toHaveValue(event.location ?? '')
    expect(within(preview()).getByText('Add to Calendar')).toBeInTheDocument()

    type('Calendar Title', ' ')
    fireEvent.click(saveButton())
    expect(
      await screen.findByText('Enter a calendar title.'),
    ).toBeInTheDocument()
    expect(field('Calendar Title')).toHaveFocus()

    type('Calendar Title', 'Party')
    type('Date', '')
    fireEvent.click(saveButton())
    expect(await screen.findByText('Enter a valid date.')).toBeInTheDocument()

    type('Date', '2031-02-03')
    type('Time', '')
    fireEvent.click(saveButton())
    expect(await screen.findByText('Enter a valid time.')).toBeInTheDocument()

    type('Time', '20:00')
    type('Location', 'The Beach')
    await save()
    expect((await services.rsvp.getSettings(MAIN)).calendar).toEqual({
      enabled: true,
      title: 'Party',
      date: '2031-02-03',
      time: '20:00',
      location: 'The Beach',
    })
  })

  it('accepts only a YouTube address for the video link', async () => {
    const { services } = await openSettings()

    fireEvent.click(screen.getByRole('switch', { name: /YouTube Link/ }))
    type('YouTube URL', 'https://video.example.com/1')
    fireEvent.click(saveButton())
    expect(
      await screen.findByText(
        'Enter a YouTube address that starts with https://.',
      ),
    ).toBeInTheDocument()
    expect(
      within(preview()).queryByText('Watch on YouTube'),
    ).not.toBeInTheDocument()

    type('YouTube URL', 'https://youtu.be/abc')
    expect(within(preview()).getByText('Watch on YouTube')).toBeInTheDocument()
    await save()
    expect((await services.rsvp.getSettings(MAIN)).youtube).toEqual({
      enabled: true,
      url: 'https://youtu.be/abc',
    })
  })

  it('checks a chosen picture, shrinks it, shows it and can remove it', async () => {
    const { services } = await openSettings()

    choose(imageFile('image/gif'))
    expect(
      await screen.findByText('Choose a JPG or PNG image.'),
    ).toBeInTheDocument()
    choose(imageFile('image/png', 6 * 1024 * 1024))
    expect(
      await screen.findByText('The image is larger than 5 MB.'),
    ).toBeInTheDocument()
    // jsdom cannot read pictures, which is what an unreadable file looks like.
    choose(imageFile('image/png'))
    expect(
      await screen.findByText('The image could not be used. Try another one.'),
    ).toBeInTheDocument()

    const picture = 'data:image/jpeg;base64,AAAA'
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 4000, height: 2000, close: () => undefined }),
    )
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(picture)

    choose(imageFile('image/jpeg'))

    expect(
      await screen.findByRole('img', { name: 'Background image' }),
    ).toHaveAttribute('src', picture)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800)
    expect(
      screen.getByRole('button', { name: 'Change Image' }),
    ).toBeInTheDocument()
    await save()
    expect((await services.rsvp.getSettings(MAIN)).backgroundImage).toBe(
      picture,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(
      screen.getByText('No image. A plain background is used.'),
    ).toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  it('gives up on a picture that cannot be made small enough', async () => {
    await openSettings()
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 100, height: 100, close: () => undefined }),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => undefined,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'x'.repeat(800_000),
    )

    choose(imageFile('image/jpeg'))

    expect(
      await screen.findByText('The image could not be used. Try another one.'),
    ).toBeInTheDocument()
  })

  it('copies the link, and says so when it cannot', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await openSettings()

    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }))
    expect(await screen.findByText('Link copied.')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(field('RSVP link').value)

    writeText.mockRejectedValueOnce(new Error('blocked'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }))
    expect(
      await screen.findByText(
        'The link could not be copied. Select it and copy it yourself.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the QR code of the link and a full-size preview', async () => {
    await openSettings()

    fireEvent.click(screen.getByRole('button', { name: 'Show QR Code' }))
    const qr = await screen.findByRole('dialog', { name: 'RSVP QR Code' })
    expect(
      within(qr).getByRole('img', { name: 'QR code of the RSVP link' }),
    ).toBeInTheDocument()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    fireEvent.click(within(qr).getByRole('button', { name: 'Download' }))
    fireEvent.click(within(qr).getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: 'Preview Public Page' }))
    const full = await screen.findByRole('dialog', {
      name: 'Public Page Preview',
    })
    expect(
      within(full).getByRole('tab', { name: 'Declined' }),
    ).toBeInTheDocument()
  })

  it('draws a QR code that grows with the text', () => {
    const short = drawQr('https://example.com/rsvp/a')
    const long = drawQr(`https://example.com/rsvp/${'a'.repeat(200)}`)

    expect(short.path).toMatch(/^M\d+ \d+h1v1h-1z/)
    // 21 modules is the smallest code; 4 quiet modules on each side.
    expect(short.size).toBeGreaterThanOrEqual(29)
    expect(long.size).toBeGreaterThan(short.size)
  })

  it('is read-only for a Viewer and marks a past event’s page as closed', async () => {
    const first = await openSettings(DEMO_EVENTS.viewer)

    expect(field('Welcome Message')).toBeDisabled()
    expect(field('Image Overlay')).toBeDisabled()
    expect(field('RSVP Language')).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Save Changes' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Upload Image' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeEnabled()
    first.unmount()

    await openSettings(DEMO_EVENTS.past)
    expect(screen.getByText('RSVP page is closed')).toBeInTheDocument()
    expect(screen.getByText('RSVP is closed.')).toBeInTheDocument()
  })

  it('reports a save that failed and keeps what was typed', async () => {
    const services = createTestServices({
      failOperations: new Set(['rsvp.updateSettings']),
    })
    await openSettings(MAIN, services)

    type('Declined Message', 'Next time')
    fireEvent.click(saveButton())

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(field('Declined Message')).toHaveValue('Next time')
    expect(saveButton()).toBeEnabled()
  })

  it('splits into Settings and Preview tabs on a phone', async () => {
    setViewportWidth(390)
    await openSettings()

    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.queryByRole('group', { name: 'Preview of the public RSVP page' }),
    ).not.toBeInTheDocument()
    const bar = screen.getByRole('region', { name: 'Page actions' })
    expect(
      within(bar).getByRole('button', { name: 'Save Changes' }),
    ).toBeInTheDocument()

    type('Welcome Message', 'Phone edit')
    fireEvent.click(
      within(bar).getByRole('button', { name: 'Preview Public Page' }),
    )

    expect(within(preview()).getByText('Phone edit')).toBeInTheDocument()
    expect(
      within(bar).getByRole('link', { name: 'Open Public Page' }),
    ).toBeInTheDocument()
    fireEvent.click(
      within(bar).getByRole('button', { name: 'Back to Settings' }),
    )
    expect(field('Welcome Message')).toHaveValue('Phone edit')
  })
})
