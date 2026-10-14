import { useTranslation } from 'react-i18next'
import {
  seatingState,
  type DashboardMetrics,
  type DashboardWarnings,
} from '../../domain/metrics.ts'
import { useFormatters } from '../../i18n/format.ts'

export interface SeatingNotice {
  /** A warning when people would be left without a seat; otherwise good news. */
  tone: 'warning' | 'success'
  title: string
  body: string
}

/** The seating message shown on the Dashboard, Event Layout and Event Settings. */
export function useSeatingNotice(
  figures:
    | { metrics: DashboardMetrics; warnings: DashboardWarnings }
    | null
    | undefined,
  maxAttendees: number,
): SeatingNotice | null {
  const { t } = useTranslation()
  const { number } = useFormatters()
  const state = figures ? seatingState(figures.warnings) : null
  if (!figures || !state) {
    return null
  }
  const { metrics } = figures
  const values = {
    seats: number(metrics.seatingCapacity),
    confirmed: number(metrics.confirmedAttendees),
    max: number(maxAttendees),
  }
  if (state.kind === 'short') {
    return {
      tone: 'warning',
      title: t('dashboard.warnings.seatsShort.title'),
      body: t('dashboard.warnings.seatsShort.body', {
        ...values,
        short: number(state.short),
      }),
    }
  }
  const key = state.kind === 'below' ? 'seatingBelow' : 'seatingAbove'
  return {
    tone: 'success',
    title: t(`dashboard.warnings.${key}.title`),
    body: t(`dashboard.warnings.${key}.body`, {
      ...values,
      difference: number(state.difference),
    }),
  }
}
