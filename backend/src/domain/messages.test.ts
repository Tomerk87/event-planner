import { describe, expect, it } from 'vitest'
import { isDomainError } from './errors.ts'
import {
  buildWhatsAppUrl,
  findUnknownVariables,
  hasVariable,
  insertText,
  MESSAGE_MAX_LENGTH,
  parseMessage,
  toggleMark,
  validateTemplate,
} from './messages.ts'

describe('buildWhatsAppUrl', () => {
  it('uses the full international number with digits only', () => {
    expect(buildWhatsAppUrl('+972507308828', 'Hi')).toBe(
      'https://wa.me/972507308828?text=Hi',
    )
    expect(buildWhatsAppUrl('+1 (555) 019-9', 'Hi')).toBe(
      'https://wa.me/15550199?text=Hi',
    )
  })

  it('percent-encodes the message', () => {
    expect(buildWhatsAppUrl('+15550199', 'Hello, I would like to order')).toBe(
      'https://wa.me/15550199?text=Hello%2C%20I%20would%20like%20to%20order',
    )
    const url = buildWhatsAppUrl('+15550199', 'A?\nB&C #1 שלום 🎉')
    expect(url).toContain('A%3F%0AB%26C%20%231%20')
    expect(url.split('?text=')[1]).not.toMatch(/[\s?&#]/)
    expect(decodeURIComponent(url.split('?text=')[1] ?? '')).toBe(
      'A?\nB&C #1 שלום 🎉',
    )
  })

  it('leaves the recipient out when none is given', () => {
    expect(buildWhatsAppUrl(null, 'Hi there')).toBe(
      'https://wa.me/?text=Hi%20there',
    )
  })
})

describe('validateTemplate', () => {
  const reasonOf = (body: string) => {
    try {
      validateTemplate(body)
      return null
    } catch (error) {
      return isDomainError(error, 'VALIDATION') ? error.details.reason : 'other'
    }
  }

  it('accepts a message up to the limit and returns it unchanged', () => {
    expect(validateTemplate(' Hi \n')).toBe(' Hi \n')
    expect(reasonOf('x'.repeat(MESSAGE_MAX_LENGTH))).toBeNull()
  })

  it('refuses an empty or over-long message', () => {
    expect(reasonOf('')).toBe('empty')
    expect(reasonOf(' \n ')).toBe('empty')
    expect(reasonOf('x'.repeat(MESSAGE_MAX_LENGTH + 1))).toBe('tooLong')
  })
})

describe('template variables', () => {
  it('finds placeholders that are not variables, each once', () => {
    expect(
      findUnknownVariables(
        'Hi {{first_name}} {{name}} {{ Table }} {{name}} {{rsvp_url}}',
      ),
    ).toEqual(['name', 'Table'])
    expect(findUnknownVariables('Hi {{first_name}}, 50% {off}')).toEqual([])
  })

  it('tells whether a variable is used, spaces allowed', () => {
    expect(hasVariable('Go: {{ rsvp_url }}', 'rsvp_url')).toBe(true)
    expect(hasVariable('Go: {{rsvp_urls}} rsvp_url', 'rsvp_url')).toBe(false)
  })
})

describe('editing', () => {
  it('inserts at the cursor and replaces a selection', () => {
    expect(insertText('Hi !', 3, 3, '{{first_name}}')).toEqual({
      text: 'Hi {{first_name}}!',
      selectionStart: 17,
      selectionEnd: 17,
    })
    expect(insertText('Hi you!', 3, 6, 'all')).toMatchObject({
      text: 'Hi all!',
      selectionStart: 6,
    })
  })

  it('wraps the selection in a mark and keeps it selected', () => {
    expect(toggleMark('Hi all!', 3, 6, 'bold')).toEqual({
      text: 'Hi *all*!',
      selectionStart: 4,
      selectionEnd: 7,
    })
    expect(toggleMark('Hi all!', 3, 6, 'italic').text).toBe('Hi _all_!')
    expect(toggleMark('Hi all!', 3, 6, 'strike').text).toBe('Hi ~all~!')
  })

  it('removes a mark the selection already has', () => {
    expect(toggleMark('Hi *all*!', 4, 7, 'bold')).toEqual({
      text: 'Hi all!',
      selectionStart: 3,
      selectionEnd: 6,
    })
  })

  it('puts the cursor between the marks when nothing is selected', () => {
    expect(toggleMark('Hi ', 3, 3, 'bold')).toEqual({
      text: 'Hi **',
      selectionStart: 4,
      selectionEnd: 4,
    })
  })
})

describe('parseMessage', () => {
  it('leaves plain text alone', () => {
    expect(parseMessage('Hello there\nline two')).toEqual([
      { type: 'text', text: 'Hello there\nline two' },
    ])
    expect(parseMessage('')).toEqual([])
  })

  it('reads bold, italic and strikethrough', () => {
    expect(parseMessage('a *b* _c_ ~d~')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'strike', children: [{ type: 'text', text: 'd' }] },
    ])
  })

  it('reads a mark inside another', () => {
    expect(parseMessage('*very _much_*')).toEqual([
      {
        type: 'bold',
        children: [
          { type: 'text', text: 'very ' },
          { type: 'italic', children: [{ type: 'text', text: 'much' }] },
        ],
      },
    ])
  })

  it('does not format marks that are not around a word', () => {
    for (const text of ['5*3*2', 'a * b * c', 'snake_case_name', '*\n*']) {
      expect(parseMessage(text)).toEqual([{ type: 'text', text }])
    }
  })

  it('shows web addresses as links, underscores and all', () => {
    expect(parseMessage('Go: https://x.example.com/a_b_c now')).toEqual([
      { type: 'text', text: 'Go: ' },
      { type: 'link', text: 'https://x.example.com/a_b_c' },
      { type: 'text', text: ' now' },
    ])
  })
})
