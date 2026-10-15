import { AttemptLimiter } from './attempt-limiter.ts'

function attempt(limiter: AttemptLimiter, key: string): boolean {
  if (!limiter.allows(key)) {
    return false
  }
  limiter.record(key)
  return true
}

describe('AttemptLimiter', () => {
  it('allows the limit within the window, then refuses', () => {
    const limiter = new AttemptLimiter(3, 1000, () => 0)

    expect([1, 2, 3, 4].map(() => attempt(limiter, 'a'))).toEqual([
      true,
      true,
      true,
      false,
    ])
  })

  it('counts only what is recorded', () => {
    const limiter = new AttemptLimiter(1, 1000, () => 0)

    expect(limiter.allows('a')).toBe(true)
    expect(limiter.allows('a')).toBe(true)
    limiter.record('a')
    expect(limiter.allows('a')).toBe(false)
  })

  it('counts each key on its own', () => {
    const limiter = new AttemptLimiter(1, 1000, () => 0)

    expect(attempt(limiter, 'a')).toBe(true)
    expect(attempt(limiter, 'b')).toBe(true)
    expect(attempt(limiter, 'a')).toBe(false)
  })

  it('allows again once the earliest attempt leaves the window', () => {
    let now = 0
    const limiter = new AttemptLimiter(2, 1000, () => now)
    attempt(limiter, 'a')
    now = 500
    attempt(limiter, 'a')

    now = 999
    expect(attempt(limiter, 'a')).toBe(false)
    now = 1000
    expect(attempt(limiter, 'a')).toBe(true)
  })

  it('forgets idle keys over time without changing the counts', () => {
    let now = 0
    const limiter = new AttemptLimiter(1, 10, () => now)
    for (let index = 0; index < 999; index += 1) {
      limiter.record(`k${index}`)
    }
    now = 20
    // The thousandth record prunes; every earlier key is outside the window.
    limiter.record('k0')
    expect(limiter.allows('k0')).toBe(false)
    expect(limiter.allows('k1')).toBe(true)
  })
})
