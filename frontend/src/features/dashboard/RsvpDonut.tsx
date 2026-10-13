import type { RsvpShare } from '../../domain/metrics.ts'
import styles from './Dashboard.module.css'

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface RsvpDonutProps {
  shares: readonly RsvpShare[]
  /** What the chart shows, for assistive technology. */
  label: string
  total: string
  totalLabel: string
}

/**
 * A ring divided by RSVP status. The figures themselves are in the table
 * beside it; the ring is a picture of them.
 */
export function RsvpDonut({
  shares,
  label,
  total,
  totalLabel,
}: RsvpDonutProps) {
  const sum = shares.reduce((count, share) => count + share.count, 0)
  let offset = 0

  return (
    <div className={styles.donut} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className={styles.donutTrack} cx="50" cy="50" r={RADIUS} />
        {sum > 0 &&
          shares.map((share) => {
            const length = (share.count / sum) * CIRCUMFERENCE
            const start = offset
            offset += length
            return (
              share.count > 0 && (
                <circle
                  key={share.segment}
                  className={styles[`stroke_${share.segment}`]}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={-start}
                />
              )
            )
          })}
      </svg>
      <div className={styles.donutCenter} aria-hidden="true">
        <span className={styles.donutTotal}>{total}</span>
        <span className={styles.donutLabel}>{totalLabel}</span>
      </div>
    </div>
  )
}
