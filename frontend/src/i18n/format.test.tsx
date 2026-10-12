import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatNumber,
  formatTime,
  useFormatters,
} from './format.ts'
import { changeLanguage } from './i18n.ts'
import { LocaleScope } from './LocaleScope.tsx'

// 18:30 in Jerusalem (UTC+3 in summer), 11:30 in New York.
const eventStart = new Date('2025-06-15T15:30:00Z')

describe('formatters', () => {
  it('groups digits in numbers', () => {
    expect(formatNumber(3000, 'en')).toBe('3,000')
    expect(formatNumber(3000, 'he')).toBe('3,000')
    expect(formatNumber(50, 'en')).toBe('50')
  })

  it('formats a date in each language', () => {
    expect(formatDate(eventStart, 'en', 'Asia/Jerusalem')).toBe('Jun 15, 2025')
    expect(formatDate(eventStart, 'he', 'Asia/Jerusalem')).toBe('15 ביוני 2025')
  })

  it('formats a 24-hour time in each language', () => {
    expect(formatTime(eventStart, 'en', 'Asia/Jerusalem')).toBe('18:30')
    expect(formatTime(eventStart, 'he', 'Asia/Jerusalem')).toBe('18:30')
  })

  it('uses the given time zone, not the viewer’s', () => {
    expect(formatTime(eventStart, 'en', 'America/New_York')).toBe('11:30')
    expect(
      formatDate(new Date('2025-06-15T22:30:00Z'), 'en', 'Asia/Jerusalem'),
    ).toBe('Jun 16, 2025')
    expect(
      formatDate(new Date('2025-06-15T22:30:00Z'), 'en', 'America/New_York'),
    ).toBe('Jun 15, 2025')
  })

  it('shows midnight as 00, not 24', () => {
    expect(
      formatTime(new Date('2025-06-14T21:00:00Z'), 'en', 'Asia/Jerusalem'),
    ).toBe('00:00')
  })
})

function EventDate() {
  const format = useFormatters()
  return (
    <p>
      {`${format.date(eventStart, 'Asia/Jerusalem')} / ${format.time(eventStart, 'Asia/Jerusalem')} / ${format.number(1640)}`}
    </p>
  )
}

describe('useFormatters', () => {
  it('follows the interface language', async () => {
    render(<EventDate />)
    expect(screen.getByText('Jun 15, 2025 / 18:30 / 1,640')).toBeInTheDocument()

    await changeLanguage('he')

    expect(
      await screen.findByText('15 ביוני 2025 / 18:30 / 1,640'),
    ).toBeInTheDocument()
  })

  it('follows a fixed guest-facing language inside a LocaleScope', () => {
    render(
      <LocaleScope language="he">
        <EventDate />
      </LocaleScope>,
    )

    expect(
      screen.getByText('15 ביוני 2025 / 18:30 / 1,640'),
    ).toBeInTheDocument()
  })
})
