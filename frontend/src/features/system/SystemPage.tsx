import { useMutation, useQuery } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../app/session/sessionContext.ts'
import { useCurrentUser } from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { NotFoundPage } from '../../shared/NotFoundPage.tsx'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { ltr } from '../../shared/ltr.ts'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import styles from './System.module.css'

/**
 * The server's settings, for a Super User of a real account (D91). It only
 * shows them: they change in the server's configuration, which the browser
 * never reaches, so no secret is ever on this page.
 */
export function SystemPage() {
  const { session } = useSession()
  const user = useCurrentUser()

  if (user.isPending) {
    return <LoadingState />
  }
  if (session?.workspace !== 'account' || !user.data?.isSuperUser) {
    return <NotFoundPage />
  }
  return <EmailSettings email={user.data.email} />
}

function EmailSettings({ email }: { email: string }) {
  const { t } = useTranslation()
  const { system } = useServices()
  const { showToast } = useToast()
  const status = useQuery({
    queryKey: ['system', 'email'],
    queryFn: () => system.getEmailStatus(),
  })
  const test = useMutation({
    mutationFn: () => system.sendTestEmail(),
    onSuccess: ({ sent }) =>
      showToast(
        sent
          ? {
              tone: 'success',
              message: t('system.email.testSent', { email: ltr(email) }),
            }
          : { tone: 'info', message: t('system.email.testOff') },
      ),
    onError: (error) =>
      showToast({ tone: 'danger', message: describeError(t, error) }),
  })

  const header = (
    <PageHeader title={t('pages.system')} subtitle={t('system.subtitle')} />
  )

  if (status.isPending) {
    return (
      <>
        {header}
        <LoadingState />
      </>
    )
  }
  if (status.isError) {
    return (
      <>
        {header}
        <Card>
          <ErrorState
            description={describeError(t, status.error)}
            onRetry={() => void status.refetch()}
          />
        </Card>
      </>
    )
  }

  const settings = status.data
  const on = settings.mode === 'smtp'
  const notSet = t('system.email.none')

  return (
    <>
      {header}
      <Card title={t('system.email.title')}>
        <div className={styles.body}>
          <dl className={styles.facts}>
            <dt>{t('system.email.status')}</dt>
            <dd>
              <Badge tone={on ? 'success' : 'neutral'} icon={<Mail />}>
                {t(on ? 'system.email.on' : 'system.email.off')}
              </Badge>
            </dd>
            <dt>{t('system.email.server')}</dt>
            <dd>
              {settings.host ? (
                <LtrText>{`${settings.host}:${settings.port}`}</LtrText>
              ) : (
                notSet
              )}
            </dd>
            <dt>{t('system.email.from')}</dt>
            <dd>
              {settings.from ? <LtrText>{settings.from}</LtrText> : notSet}
            </dd>
            <dt>{t('system.email.authenticated')}</dt>
            <dd>
              {t(
                settings.authenticated ? 'system.email.yes' : 'system.email.no',
              )}
            </dd>
          </dl>
          {!on && <Notice title={t('system.email.offHint')} />}
        </div>
        <div className={styles.test}>
          <Button
            variant="secondary"
            icon={<Mail />}
            loading={test.isPending}
            disabled={!on}
            onClick={() => test.mutate()}
          >
            {t('system.email.test')}
          </Button>
          <span>{t('system.email.testHint', { email: ltr(email) })}</span>
        </div>
      </Card>
    </>
  )
}
