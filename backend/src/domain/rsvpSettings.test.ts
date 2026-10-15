import { describe, expect, it } from 'vitest'
import { DomainError } from './errors.ts'
import {
  buildGoogleCalendarUrl,
  calendarStartOf,
  isYouTubeUrl,
  validateRsvpSettings,
} from './rsvpSettings.ts'

const settings = {
  welcomeMessage: 'Welcome',
  approvedMessage: 'Great',
  declinedMessage: 'Pity',
  notSureMessage: 'Fine',
  backgroundImage: null,
  overlayOpacity: 40,
  imageZoom: 100,
  imagePositionX: 50,
  imagePositionY: 50,
  calendar: {
    enabled: false,
    title: 'Garden Party',
    date: '2030-06-15',
    time: '18:30',
    location: 'Tel Aviv',
  },
  youtube: { enabled: false, url: '' },
}

function fieldOf(action: () => unknown): string {
  try {
    action()
  } catch (error) {
    if (error instanceof DomainError && error.code === 'VALIDATION') {
      return String(error.details.field)
    }
  }
  return 'NO_ERROR'
}

describe('isYouTubeUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=abc',
    'https://youtube.com/live/abc',
    'https://m.youtube.com/watch?v=abc',
    ' https://youtu.be/abc ',
  ])('accepts %j', (url) => {
    expect(isYouTubeUrl(url)).toBe(true)
  })

  it.each([
    '',
    'not a link',
    'http://www.youtube.com/watch?v=abc',
    'https://video.example.com/watch?v=abc',
    'https://youtube.com.example.com/watch',
    'javascript:alert(1)',
  ])('refuses %j', (url) => {
    expect(isYouTubeUrl(url)).toBe(false)
  })
})

describe('validateRsvpSettings', () => {
  it('returns tidy settings', () => {
    expect(
      validateRsvpSettings({
        ...settings,
        calendar: {
          ...settings.calendar,
          title: '  Party ',
          location: ' Hall ',
        },
        youtube: { enabled: true, url: ' https://youtu.be/abc ' },
      }),
    ).toMatchObject({
      calendar: { title: 'Party', location: 'Hall' },
      youtube: { url: 'https://youtu.be/abc' },
    })
  })

  it.each([
    ['welcomeMessage', { welcomeMessage: 'x'.repeat(501) }],
    ['notSureMessage', { notSureMessage: 'x'.repeat(501) }],
    ['overlayOpacity', { overlayOpacity: 101 }],
    ['overlayOpacity', { overlayOpacity: 12.5 }],
    ['imageZoom', { imageZoom: 99 }],
    ['imageZoom', { imageZoom: 301 }],
    ['imagePositionX', { imagePositionX: -1 }],
    ['imagePositionY', { imagePositionY: 100.5 }],
    ['backgroundImage', { backgroundImage: 'https://example.com/a.png' }],
    [
      'backgroundImage',
      { backgroundImage: `data:image/jpeg;base64,${'A'.repeat(700_000)}` },
    ],
    [
      'calendarTitle',
      { calendar: { ...settings.calendar, enabled: true, title: ' ' } },
    ],
    [
      'calendarTitle',
      { calendar: { ...settings.calendar, title: 'x'.repeat(121) } },
    ],
    [
      'calendarLocation',
      { calendar: { ...settings.calendar, location: 'x'.repeat(121) } },
    ],
    [
      'calendarDate',
      { calendar: { ...settings.calendar, enabled: true, date: '2030-02-30' } },
    ],
    [
      'calendarDate',
      { calendar: { ...settings.calendar, enabled: true, date: '' } },
    ],
    [
      'calendarTime',
      { calendar: { ...settings.calendar, enabled: true, time: '25:00' } },
    ],
    ['youtubeUrl', { youtube: { enabled: true, url: 'https://example.com' } }],
  ])('refuses a bad %s', (field, patch) => {
    expect(fieldOf(() => validateRsvpSettings({ ...settings, ...patch }))).toBe(
      field,
    )
  })

  it('does not check the details of an action that is switched off', () => {
    expect(
      fieldOf(() =>
        validateRsvpSettings({
          ...settings,
          calendar: { ...settings.calendar, title: '', date: '', time: '' },
          youtube: { enabled: false, url: 'half typed' },
        }),
      ),
    ).toBe('NO_ERROR')
  })

  it('accepts a small picture', () => {
    expect(
      validateRsvpSettings({
        ...settings,
        backgroundImage: 'data:image/png;base64,AAAA',
      }).backgroundImage,
    ).toBe('data:image/png;base64,AAAA')
  })
})

describe('calendar entry', () => {
  it('starts at the event’s own date and time, in its time zone', () => {
    expect(
      calendarStartOf({
        startsAt: '2030-06-15T15:30:00.000Z',
        timeZone: 'Asia/Jerusalem',
      }),
    ).toEqual({ date: '2030-06-15', time: '18:30' })
  })

  it('builds the Google Calendar address, three hours long', () => {
    const url = new URL(
      buildGoogleCalendarUrl(settings.calendar, 'Asia/Jerusalem') ?? '',
    )

    expect(url.origin + url.pathname).toBe(
      'https://calendar.google.com/calendar/render',
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'Garden Party',
      dates: '20300615T183000/20300615T213000',
      ctz: 'Asia/Jerusalem',
      location: 'Tel Aviv',
    })
  })

  it('runs past midnight into the next day, and leaves out an empty location', () => {
    const url = new URL(
      buildGoogleCalendarUrl(
        {
          ...settings.calendar,
          date: '2030-12-31',
          time: '22:15',
          location: '',
        },
        'UTC',
      ) ?? '',
    )

    expect(url.searchParams.get('dates')).toBe(
      '20301231T221500/20310101T011500',
    )
    expect(url.searchParams.has('location')).toBe(false)
  })

  it('has no address without a usable date and time', () => {
    expect(
      buildGoogleCalendarUrl({ ...settings.calendar, date: '' }, 'UTC'),
    ).toBeNull()
    expect(
      buildGoogleCalendarUrl({ ...settings.calendar, time: '7pm' }, 'UTC'),
    ).toBeNull()
  })
})
