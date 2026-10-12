import { describe, expect, it } from 'vitest'
import { parseDataProvider } from './providerConfig.ts'

describe('parseDataProvider', () => {
  it.each([undefined, ''])('defaults to mock when the value is %j', (value) => {
    expect(parseDataProvider(value)).toBe('mock')
  })

  it.each(['mock', 'api'] as const)('accepts %s', (value) => {
    expect(parseDataProvider(value)).toBe(value)
  })

  it.each(['API', 'demo', ' mock'])('rejects %j', (value) => {
    expect(() => parseDataProvider(value)).toThrow('Invalid VITE_DATA_PROVIDER')
  })
})
