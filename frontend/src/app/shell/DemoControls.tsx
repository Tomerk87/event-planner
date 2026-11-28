import { FlaskConical, RotateCcw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DemoRole } from '../../services/contracts/index.ts'
import {
  useDemoRole,
  useDemoViewAs,
  useResetDemo,
  useSetDemoRole,
  useSetDemoViewAs,
} from '../../services/queries.ts'
import { useLocation, useNavigate } from 'react-router'
import { ArrowLeftRight, Building2, User } from 'lucide-react'
import type { DemoView } from '../../services/contracts/index.ts'
import { useServices } from '../../services/servicesContext.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField } from '../../shared/ui/Field.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import styles from './DemoControls.module.css'

const SIMULATED_ROLES: readonly DemoRole[] = [
  'OWNER',
  'ADMIN',
  'VIEWER',
  'SUPER_USER',
]

const OWN_ROLE = 'OWN'

function isDemoRole(value: string): value is DemoRole {
  return (SIMULATED_ROLES as readonly string[]).includes(value)
}

/**
 * Switches who the venue demo shows (#23). It stays on the shared event when
 * both people can open it; anywhere the client can't go, it opens their
 * event, and the venue's own pages take the demo user back to the venue.
 */
function useSwitchDemoView() {
  const viewAs = useDemoViewAs()
  const setViewAs = useSetDemoViewAs()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return {
    isPending: setViewAs.isPending,
    run: (view: DemoView) => {
      const data = viewAs.data
      if (!data) {
        return
      }
      setViewAs.mutate(view, {
        onSuccess: () => {
          const onClientEvent = pathname.startsWith(
            `/events/${data.client.eventId}/`,
          )
          if (view === 'CLIENT' && !onClientEvent) {
            void navigate(`/events/${data.client.eventId}/dashboard`)
          } else if (view === 'SELF' && !onClientEvent) {
            void navigate('/events')
          }
        },
      })
    },
  }
}

/**
 * Says whose view the venue demo shows, with a way back (#23). Nothing when
 * the demo has no venues.
 */
export function DemoViewBanner({
  onVenuePage = false,
}: {
  /** On the venue's pages the venue owner's view is named too. */
  onVenuePage?: boolean
}) {
  const { t } = useTranslation()
  const viewAs = useDemoViewAs()
  const switchView = useSwitchDemoView()
  const data = viewAs.data
  const asClient = data?.view === 'CLIENT'
  if (!data || (!asClient && !onVenuePage)) {
    return null
  }
  return (
    <div className={styles.viewBanner} role="status">
      <span className={styles.viewBannerIcon} aria-hidden="true">
        {asClient ? <User /> : <Building2 />}
      </span>
      <div className={styles.viewBannerText}>
        <p className={styles.viewBannerTitle}>
          {asClient
            ? t('demo.viewAs.asClientTitle', { name: data.client.name })
            : t('demo.viewAs.asSelfTitle')}
        </p>
        <p>
          {asClient
            ? t('demo.viewAs.asClientBody', {
                name: data.client.name,
                venue: data.self.venueName,
              })
            : t('demo.viewAs.asSelfBody', {
                name: data.self.name,
                venue: data.self.venueName,
                client: data.client.name,
              })}
        </p>
      </div>
      <Button
        variant="ghost"
        icon={<ArrowLeftRight />}
        loading={switchView.isPending}
        onClick={() => switchView.run(asClient ? 'SELF' : 'CLIENT')}
      >
        {asClient
          ? t('demo.viewAs.switchSelf')
          : t('demo.viewAs.switchClient', { name: data.client.name })}
      </Button>
    </div>
  )
}

/** Shown on every page while the application runs on demo data. */
export function DemoBadge() {
  const { t } = useTranslation()
  const format = useFormatters()
  const { demo } = useServices()
  const { showToast } = useToast()

  const ends = useQuery({
    queryKey: ['demo', 'endsAt'],
    queryFn: () => demo?.getEndsAt() ?? null,
    enabled: demo !== null,
  })
  // When the demo ends at the latest (D99), on hover.
  const endsAt = ends.data
    ? t('demo.endsAt', {
        date: format.date(new Date(ends.data)),
        time: format.time(new Date(ends.data)),
      })
    : null

  useEffect(() => {
    if (demo?.consumeRegeneratedNotice()) {
      showToast({ tone: 'info', message: t('demo.regenerated') })
    }
  }, [demo, showToast, t])

  if (!demo) {
    return null
  }

  return (
    <span title={endsAt ?? undefined}>
      <Badge tone="warning" icon={<FlaskConical />}>
        <span className={styles.badgeText}>{t('demo.badge')}</span>
      </Badge>
    </span>
  )
}

/**
 * Demo-only controls: a simulated role, which changes what this browser's
 * demo allows and nothing else, and a reset to the original sample data.
 */
export function DemoTools({
  showRole = true,
}: {
  /** Off on a venue event, where roles come from the venue (D112, D113). */
  showRole?: boolean
} = {}) {
  const { t } = useTranslation()
  const { demo } = useServices()
  const { showToast } = useToast()
  const role = useDemoRole()
  const setRole = useSetDemoRole()
  const viewAs = useDemoViewAs()
  const switchView = useSwitchDemoView()
  const asClient = viewAs.data?.view === 'CLIENT'
  const reset = useResetDemo()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!demo) {
    return null
  }

  function confirmReset() {
    reset.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false)
        showToast({ tone: 'success', message: t('demo.resetDone') })
      },
      onError: (error) => {
        setConfirmOpen(false)
        showToast({ tone: 'danger', message: describeError(t, error) })
      },
    })
  }

  return (
    <div
      className={styles.tools}
      role="group"
      aria-label={t('demo.toolsLabel')}
    >
      {viewAs.data && (
        <div className={styles.viewAs}>
          <SelectField
            label={t('demo.viewAs.label')}
            hideLabel
            value={viewAs.data.view}
            disabled={switchView.isPending}
            onChange={(event) =>
              switchView.run(
                event.target.value === 'CLIENT' ? 'CLIENT' : 'SELF',
              )
            }
          >
            <option value="SELF">
              {t('demo.viewAs.self', { name: viewAs.data.self.name })}
            </option>
            <option value="CLIENT">
              {t('demo.viewAs.client', { name: viewAs.data.client.name })}
            </option>
          </SelectField>
        </div>
      )}
      {showRole && !asClient && (
        <div className={styles.role}>
          <SelectField
            label={t('demo.roleLabel')}
            hideLabel
            value={role.data ?? OWN_ROLE}
            disabled={role.isPending || setRole.isPending}
            onChange={(event) =>
              setRole.mutate(
                isDemoRole(event.target.value) ? event.target.value : null,
              )
            }
          >
            <option value={OWN_ROLE}>{t('demo.roleOwn')}</option>
            {SIMULATED_ROLES.map((option) => (
              <option key={option} value={option}>
                {t(`demo.simulate.${option}`)}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      <Button
        variant="secondary"
        icon={<RotateCcw />}
        onClick={() => setConfirmOpen(true)}
      >
        {t('demo.reset')}
      </Button>
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('demo.resetTitle')}
        footer={
          <>
            <Button
              data-autofocus
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={reset.isPending}
              onClick={confirmReset}
            >
              {t('demo.reset')}
            </Button>
          </>
        }
      >
        {t('demo.resetBody')}
      </Dialog>
    </div>
  )
}
