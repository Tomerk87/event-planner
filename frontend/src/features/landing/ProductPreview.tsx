import {
  Armchair,
  CalendarCheck,
  CircleCheck,
  CircleX,
  Clock,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormatters } from '../../i18n/format.ts'
import { cx } from '../../shared/ui/cx.ts'
import styles from './ProductPreview.module.css'

// Illustrative figures for the picture only; they describe no real event.
const TOTAL = 164
const KPIS = [
  { id: 'total', icon: Users, value: TOTAL, tone: 'info' },
  { id: 'approved', icon: CircleCheck, value: 112, tone: 'success' },
  { id: 'awaiting', icon: Clock, value: 34, tone: 'warning' },
  { id: 'declined', icon: CircleX, value: 18, tone: 'danger' },
] as const

const GUESTS = [
  { id: 'first', status: 'approved', tone: 'success' },
  { id: 'second', status: 'approved', tone: 'success' },
  { id: 'third', status: 'awaiting', tone: 'warning' },
  { id: 'fourth', status: 'declined', tone: 'danger' },
] as const

/**
 * A small drawing of the product for the landing page. It is decorative and
 * hidden from assistive technology; the page's text says what the product does.
 */
export function ProductPreview() {
  const { t } = useTranslation()
  const format = useFormatters()
  const nav = [
    { icon: LayoutDashboard, label: t('nav.dashboard') },
    { icon: Users, label: t('nav.guests') },
    { icon: Mail, label: t('nav.rsvp') },
    { icon: MessageCircle, label: t('nav.messages') },
    { icon: Armchair, label: t('nav.eventLayout') },
  ]
  const approvedShare = Math.round((112 / TOTAL) * 100)

  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.chrome}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.window}>
        <div className={styles.sidebar}>
          <div className={styles.brand}>
            <CalendarCheck />
            {t('app.name')}
          </div>
          {nav.map(({ icon: Icon, label }, index) => (
            <div
              key={label}
              className={cx(
                styles.navItem,
                index === 0 && styles.navItemActive,
              )}
            >
              <Icon />
              {label}
            </div>
          ))}
        </div>
        <div className={styles.content}>
          <div className={styles.eventName}>{t('landing.preview.event')}</div>
          <div className={styles.kpis}>
            {KPIS.map(({ id, icon: Icon, value, tone }) => (
              <div key={id} className={styles.kpi}>
                <span className={cx(styles.kpiIcon, styles[tone])}>
                  <Icon />
                </span>
                <span className={styles.kpiValue}>{format.number(value)}</span>
                <span className={styles.kpiLabel}>
                  {t(`landing.preview.kpi.${id}`)}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.panels}>
            <div className={styles.panel}>
              <div className={styles.panelTitle}>
                {t('landing.preview.overview')}
              </div>
              <div className={styles.donut}>
                <span>
                  {t('landing.preview.share', {
                    percent: format.number(approvedShare),
                  })}
                </span>
              </div>
            </div>
            <div className={styles.panel}>
              <div className={styles.panelTitle}>{t('nav.guests')}</div>
              {GUESTS.map(({ id, status, tone }) => (
                <div key={id} className={styles.guest}>
                  <span className={styles.guestName}>
                    {t(`landing.preview.guests.${id}`)}
                  </span>
                  <span className={cx(styles.pill, styles[tone])}>
                    {t(`landing.preview.kpi.${status}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
