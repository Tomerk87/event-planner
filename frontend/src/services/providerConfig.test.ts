import { describe, expect, it } from 'vitest'
import { parseAccountsEnabled, parseDemoEnabled } from './providerConfig.ts'

describe('parseDemoEnabled', () => {
  it.each([undefined, '', 'true'])('turns the demo on for %j', (value) => {
    expect(parseDemoEnabled(value)).toBe(true)
  })

  it('turns the demo off for "false"', () => {
    expect(parseDemoEnabled('false')).toBe(false)
  })

  it.each(['TRUE', 'no', ' false'])('rejects %j', (value) => {
    expect(() => parseDemoEnabled(value)).toThrow('Invalid VITE_DEMO_ENABLED')
  })
})

describe('parseAccountsEnabled', () => {
  it.each([undefined, '', 'true'])('turns accounts on for %j', (value) => {
    expect(parseAccountsEnabled(value)).toBe(true)
  })

  it('turns accounts off for "false"', () => {
    expect(parseAccountsEnabled('false')).toBe(false)
  })

  it.each(['FALSE', 'off'])('rejects %j', (value) => {
    expect(() => parseAccountsEnabled(value)).toThrow(
      'Invalid VITE_ACCOUNTS_ENABLED',
    )
  })
})
