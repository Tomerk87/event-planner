/**
 * jsdom has no layout, so `window.matchMedia` is replaced with a stand-in that
 * evaluates min-width / max-width queries against a width the test controls.
 */
const DEFAULT_WIDTH = 1280

let viewportWidth = DEFAULT_WIDTH
const listeners = new Map<string, Set<() => void>>()

function matches(query: string): boolean {
  const min = /min-width:\s*(\d+)px/.exec(query)
  const max = /max-width:\s*(\d+)px/.exec(query)
  return (
    (!min || viewportWidth >= Number(min[1])) &&
    (!max || viewportWidth <= Number(max[1]))
  )
}

export function installMatchMedia(): void {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return matches(query)
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => {
        const set = listeners.get(query) ?? new Set()
        set.add(listener)
        listeners.set(query, set)
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.get(query)?.delete(listener)
      },
    }) as unknown as MediaQueryList
}

/** Call inside `act` when components are already rendered. */
export function setViewportWidth(width: number): void {
  viewportWidth = width
  for (const set of listeners.values()) {
    for (const listener of set) {
      listener()
    }
  }
}

export function resetViewportWidth(): void {
  viewportWidth = DEFAULT_WIDTH
  listeners.clear()
}
