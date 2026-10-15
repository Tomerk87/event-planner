import { useEffect, useRef } from 'react'
import { Notice } from './ui/Notice.tsx'

/**
 * Why a save failed, at the top of a form page. It scrolls itself into view:
 * Save is often pressed far below it, or from the phone's bottom bar, where a
 * message out of view looks like nothing happened.
 */
export function FailureNotice({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [message])

  return (
    <div ref={ref}>
      <Notice tone="danger" title={message} announce />
    </div>
  )
}
