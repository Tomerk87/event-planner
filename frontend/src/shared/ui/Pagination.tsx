import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageNumbers } from '../../domain/paging.ts'
import { cx } from './cx.ts'
import styles from './Pagination.module.css'

interface PaginationProps {
  /** Accessible name of the navigation, for example "Guest pages". */
  label: string
  page: number
  pageCount: number
  onPage: (page: number) => void
  previousLabel: string
  nextLabel: string
  /** Accessible name of one page button, for example "Page 3". */
  pageLabel: (page: number) => string
  formatNumber: (value: number) => string
}

export function Pagination({
  label,
  page,
  pageCount,
  onPage,
  previousLabel,
  nextLabel,
  pageLabel,
  formatNumber,
}: PaginationProps) {
  return (
    <nav aria-label={label} className={styles.pagination}>
      <button
        type="button"
        className={cx(styles.button, styles.arrow)}
        aria-label={previousLabel}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <ol className={styles.pages}>
        {pageNumbers(page, pageCount).map((number, index) =>
          number === null ? (
            // Gaps have no identity of their own; their position is stable.
            <li key={`gap-${index}`} className={styles.gap} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={number}>
              <button
                type="button"
                className={cx(styles.button, number === page && styles.current)}
                aria-label={pageLabel(number)}
                aria-current={number === page ? 'page' : undefined}
                onClick={() => onPage(number)}
              >
                {formatNumber(number)}
              </button>
            </li>
          ),
        )}
      </ol>
      <button
        type="button"
        className={cx(styles.button, styles.arrow)}
        aria-label={nextLabel}
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  )
}
