import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Languages } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { isDomainError } from '../../domain/errors.ts'
import type { RsvpResponse } from '../../domain/models.ts'
import { LANGUAGES, type Language } from '../../i18n/languages.ts'
import { LocaleScope } from '../../i18n/LocaleScope.tsx'
import type {
  PublicRsvpResult,
  PublicRsvpView,
} from '../../services/contracts/index.ts'
import { usePublicRsvp } from '../../services/servicesContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { withoutError } from '../../shared/formErrors.ts'
import standalone from '../../shared/StandalonePage.module.css'
import { Card } from '../../shared/ui/Card.tsx'
import { Menu } from '../../shared/ui/Menu.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { useDocumentTitle } from '../../shared/useDocumentTitle.ts'
import styles from './PublicRsvp.module.css'
import {
  RsvpCard,
  type RsvpFormField,
  type RsvpFormState,
  type RsvpFormValues,
} from './RsvpCard.tsx'

type FormErrors = Partial<Record<RsvpFormField, 'required' | number>>

function Form({
  slug,
  view,
  onClosed,
}: {
  slug: string
  view: PublicRsvpView
  onClosed: () => void
}) {
  const { t } = useTranslation()
  const publicRsvp = usePublicRsvp()
  const queryClient = useQueryClient()
  const ref = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<RsvpFormValues>({
    name: '',
    phone: '',
    attendees: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  // Counts refused responses; each moves focus to the field to fix.
  const [refusals, setRefusals] = useState(0)
  const [failure, setFailure] = useState(false)
  const [sending, setSending] = useState<RsvpResponse | null>(null)
  const [result, setResult] = useState<PublicRsvpResult | null>(null)

  // A refused response moves focus to the first field that needs attention.
  useEffect(() => {
    if (refusals > 0) {
      ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    }
  }, [refusals])

  function refuse(found: FormErrors) {
    setErrors(found)
    setRefusals((count) => count + 1)
  }

  async function submit(status: RsvpResponse) {
    const found: FormErrors = {}
    if (values.name.trim() === '') {
      found.name = 'required'
    }
    if (values.phone.trim() === '') {
      found.phone = 'required'
    }
    if (values.attendees === '') {
      found.attendees = 'required'
    }
    setFailure(false)
    if (Object.keys(found).length > 0) {
      refuse(found)
      return
    }
    setErrors({})

    setSending(status)
    try {
      setResult(
        await publicRsvp.submit(slug, {
          name: values.name,
          phone: values.phone,
          status,
          attendees: Number(values.attendees),
        }),
      )
      // The organizer may be looking at this event in the same browser.
      void queryClient.invalidateQueries()
    } catch (error) {
      if (isDomainError(error, 'INVALID_PHONE')) {
        refuse({ phone: 'required' })
      } else if (isDomainError(error, 'INVALID_ATTENDEE_COUNT')) {
        refuse({ attendees: Number(error.details.max) })
      } else if (isDomainError(error, 'RSVP_CLOSED')) {
        onClosed()
      } else {
        setFailure(true)
      }
    } finally {
      setSending(null)
    }
  }

  const form: RsvpFormState = {
    values,
    errors: {
      name: errors.name ? t('publicRsvp.errors.name') : undefined,
      phone: errors.phone ? t('publicRsvp.errors.phone') : undefined,
      attendees:
        errors.attendees === 'required'
          ? t('publicRsvp.errors.attendees')
          : errors.attendees !== undefined
            ? t('publicRsvp.errors.overMaximum', { max: errors.attendees })
            : undefined,
    },
    failure: failure ? t('publicRsvp.errors.failed') : null,
    sending,
    onChange: (field, value) => {
      setValues((current) => ({ ...current, [field]: value }))
      // Editing a field clears its message (D104); Send checks it again.
      setErrors((current) => withoutError(current, field))
    },
    onSubmit: (status) => void submit(status),
  }

  return (
    <div ref={ref} className={styles.fill}>
      <RsvpCard
        view={view}
        screen={view.isClosed ? 'CLOSED' : (result?.status ?? 'WELCOME')}
        form={form}
        confirmedAttendees={result?.confirmedAttendees}
        onChangeResponse={() => setResult(null)}
        titleLevel="h1"
      />
    </div>
  )
}

/** The page's language, in the page's language, with the others to choose. */
function LanguageMenu({
  language,
  onChange,
}: {
  language: Language
  onChange: (language: Language) => void
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.languageMenu}>
      <Menu
        label={t('language.label')}
        triggerClassName={styles.language}
        items={LANGUAGES.filter((other) => other !== language).map((other) => ({
          id: other,
          label: t(`language.${other}`),
          lang: other,
          onSelect: () => onChange(other),
        }))}
      >
        <Languages aria-hidden="true" />
        {t(`language.${language}`)}
      </Menu>
    </div>
  )
}

function PublicRsvp({
  slug,
  view,
  onClosed,
}: {
  slug: string
  view: PublicRsvpView
  onClosed: () => void
}) {
  const [language, setLanguage] = useState<Language>(view.language)
  useDocumentTitle(view.title)

  return (
    <LocaleScope language={language}>
      <div className={styles.fill}>
        <LanguageMenu language={language} onChange={setLanguage} />
        <Form slug={slug} view={view} onClosed={onClosed} />
      </div>
    </LocaleScope>
  )
}

function Unavailable() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.publicRsvp'))

  return (
    <Card>
      <ErrorState
        asPageHeading
        title={t('publicRsvp.unavailable.title')}
        description={t('publicRsvp.unavailable.body')}
      />
    </Card>
  )
}

/**
 * The page a guest opens from the event's shared RSVP link. It belongs to no
 * session: anyone with the link can open it, and it shows no guest records.
 */
export function PublicRsvpPage() {
  const { t } = useTranslation()
  const { rsvpId = '' } = useParams()
  const publicRsvp = usePublicRsvp()
  const event = useQuery({
    queryKey: ['publicRsvp', rsvpId],
    queryFn: () => publicRsvp.getPublicEvent(rsvpId),
  })

  // One element throughout, so the focus given to the page on arrival stays.
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={event.data ? styles.page : standalone.page}
    >
      {event.data ? (
        <PublicRsvp
          key={rsvpId}
          slug={rsvpId}
          view={event.data}
          onClosed={() => void event.refetch()}
        />
      ) : (
        <div className={standalone.panel}>
          {isDomainError(event.error, 'NOT_FOUND') ? (
            <Unavailable />
          ) : event.isError ? (
            <Card>
              <ErrorState
                asPageHeading
                description={describeError(t, event.error)}
                onRetry={() => void event.refetch()}
              />
            </Card>
          ) : (
            <LoadingState />
          )}
        </div>
      )}
    </main>
  )
}
