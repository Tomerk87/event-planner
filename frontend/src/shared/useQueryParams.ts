import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

type Changes = Record<string, string | null>

interface QueryParams {
  params: URLSearchParams
  /** Sets or removes (null or empty) the named values, keeping the others. */
  update: (changes: Changes) => void
  /** Replaces every value at once. */
  replaceAll: (values: Record<string, string>) => void
}

/**
 * Page state kept in the address: filters, sorting, paging, the open tab.
 *
 * Changes are applied on top of the latest change requested, not the latest
 * one rendered. The address is updated a moment after a change is requested,
 * so two changes in quick succession would otherwise each start from the old
 * address and the second would undo the first.
 */
export function useQueryParams(): QueryParams {
  const [params, setParams] = useSearchParams()
  const latest = useRef(params)
  // The address we asked for and have not yet seen arrive, if any.
  const awaited = useRef<string | null>(null)

  useEffect(() => {
    if (awaited.current === null || awaited.current === params.toString()) {
      latest.current = params
      awaited.current = null
    }
  }, [params])

  const apply = useCallback(
    (next: URLSearchParams) => {
      latest.current = next
      awaited.current = next.toString()
      setParams(next, { replace: true })
    },
    [setParams],
  )

  const update = useCallback(
    (changes: Changes) => {
      const next = new URLSearchParams(latest.current)
      for (const [name, value] of Object.entries(changes)) {
        if (value === null || value === '') {
          next.delete(name)
        } else {
          next.set(name, value)
        }
      }
      apply(next)
    },
    [apply],
  )

  const replaceAll = useCallback(
    (values: Record<string, string>) => apply(new URLSearchParams(values)),
    [apply],
  )

  return { params, update, replaceAll }
}
