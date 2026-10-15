import { describe, expect, it } from 'vitest'
import { mapLinks } from './mapLinks.ts'

describe('map links', () => {
  it('search Google Maps and Waze for the location as typed', () => {
    expect(mapLinks(' Hangar 11, Tel Aviv-Yafo ')).toEqual({
      google:
        'https://www.google.com/maps/search/?api=1&query=Hangar%2011%2C%20Tel%20Aviv-Yafo',
      waze: 'https://waze.com/ul?q=Hangar%2011%2C%20Tel%20Aviv-Yafo&navigate=yes',
    })
    expect(mapLinks('גני התערוכה & אולם 2').google).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('גני התערוכה & אולם 2')}`,
    )
  })
})
