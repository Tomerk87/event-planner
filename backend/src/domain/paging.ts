export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10

export interface Page<Item> {
  items: Item[]
  /** The page actually shown, after bringing an out-of-range request into range. */
  page: number
  pageCount: number
  total: number
  /** 1-based positions of the first and last item shown; 0 when there are none. */
  from: number
  to: number
}

export function paginate<Item>(
  items: readonly Item[],
  page: number,
  pageSize: number,
): Page<Item> {
  const size = Math.max(1, Math.floor(pageSize))
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(
    pageCount,
    Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1),
  )
  const start = (current - 1) * size
  const shown = items.slice(start, start + size)
  return {
    items: shown,
    page: current,
    pageCount,
    total: items.length,
    from: shown.length === 0 ? 0 : start + 1,
    to: start + shown.length,
  }
}

/** Page numbers to offer, with `null` standing for a gap: 1 2 3 4 5 … 17. */
export function pageNumbers(
  page: number,
  pageCount: number,
): (number | null)[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }
  const shown = new Set([1, pageCount, page - 1, page, page + 1])
  if (page <= 4) {
    for (let number = 1; number <= 5; number += 1) {
      shown.add(number)
    }
  }
  if (page >= pageCount - 3) {
    for (let number = pageCount - 4; number <= pageCount; number += 1) {
      shown.add(number)
    }
  }
  const numbers = [...shown]
    .filter((number) => number >= 1 && number <= pageCount)
    .sort((a, b) => a - b)
  const result: (number | null)[] = []
  numbers.forEach((number, index) => {
    const previous = numbers[index - 1]
    if (previous !== undefined && number - previous > 1) {
      result.push(null)
    }
    result.push(number)
  })
  return result
}
