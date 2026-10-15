/**
 * Counts attempts per key within a sliding window, in this process's memory.
 * The POC runs one server process, so nothing is shared; a restart clears the
 * counts, which only ever lets a few more attempts through.
 */
export class AttemptLimiter {
  private readonly attempts = new Map<string, number[]>()
  private records = 0

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Whether the key has attempts left in the window. */
  allows(key: string): boolean {
    return this.recent(key, this.now()).length < this.limit
  }

  record(key: string): void {
    const now = this.now()
    this.records += 1
    if (this.records % 1000 === 0) {
      this.prune(now)
    }
    this.attempts.set(key, [...this.recent(key, now), now])
  }

  private recent(key: string, now: number): number[] {
    return (this.attempts.get(key) ?? []).filter(
      (at) => now - at < this.windowMs,
    )
  }

  /** Forgets keys with no attempt left in the window, so memory stays small. */
  private prune(now: number): void {
    for (const [key, times] of this.attempts) {
      if (times.every((at) => now - at >= this.windowMs)) {
        this.attempts.delete(key)
      }
    }
  }
}
