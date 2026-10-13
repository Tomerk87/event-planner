import { FlaskConical, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DemoRole } from '../../services/contracts/index.ts'
import {
  useDemoRole,
  useResetDemo,
  useSetDemoRole,
} from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'
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

/** Shown on every page while the application runs on demo data. */
export function DemoBadge() {
  const { t } = useTranslation()
  const { demo } = useServices()
  const { showToast } = useToast()

  useEffect(() => {
    if (demo?.consumeRegeneratedNotice()) {
      showToast({ tone: 'info', message: t('demo.regenerated') })
    }
  }, [demo, showToast, t])

  if (!demo) {
    return null
  }

  return (
    <Badge tone="warning" icon={<FlaskConical />}>
      <span className={styles.badgeText}>{t('demo.badge')}</span>
    </Badge>
  )
}

/**
 * Demo-only controls: a simulated role, which changes what this browser's
 * demo allows and nothing else, and a reset to the original sample data.
 */
export function DemoTools() {
  const { t } = useTranslation()
  const { demo } = useServices()
  const { showToast } = useToast()
  const role = useDemoRole()
  const setRole = useSetDemoRole()
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
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
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
