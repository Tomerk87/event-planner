import { Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { isDomainError } from '../../domain/errors.ts'
import {
  CONTACT_PHONE_MAX_LENGTH,
  ORGANIZATION_NAME_MAX_LENGTH,
  venueCan,
  type VenueLanguage,
  type VenueOrganization,
} from '../../domain/venues.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { NotFoundPage } from '../../shared/NotFoundPage.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { LoadingState } from '../../shared/ui/States.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import styles from './VenueSettingsPage.module.css'
import { useUpdateOrganization } from './venueMutations.ts'
import { useVenueWorkspace } from './venueQueries.ts'

type Field = 'name' | 'contactEmail' | 'contactPhone'

const LANGUAGES: VenueLanguage[] = ['en', 'he', 'pt']

function SettingsForm({ organization }: { organization: VenueOrganization }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const save = useUpdateOrganization(organization.id)
  const [name, setName] = useState(organization.name)
  const [language, setLanguage] = useState(organization.defaultLanguage)
  const [email, setEmail] = useState(organization.contactEmail ?? '')
  const [phone, setPhone] = useState(organization.contactPhone ?? '')
  const [error, setError] = useState<Field | null>(null)

  const message = (field: Field) =>
    error === field
      ? t(`venueSettings.errors.${field}`, {
          max:
            field === 'contactPhone'
              ? CONTACT_PHONE_MAX_LENGTH
              : ORGANIZATION_NAME_MAX_LENGTH,
        })
      : undefined

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (
      name.trim() === '' ||
      name.trim().length > ORGANIZATION_NAME_MAX_LENGTH
    ) {
      setError('name')
      return
    }
    save.mutate(
      {
        name,
        defaultLanguage: language,
        contactEmail: email,
        contactPhone: phone,
      },
      {
        onSuccess: () =>
          showToast({ tone: 'success', message: t('venueSettings.saved') }),
        onError: (failure) => {
          const field = isDomainError(failure, 'VALIDATION')
            ? (failure.details?.['field'] as Field | undefined)
            : undefined
          if (field) {
            setError(field)
          } else {
            showToast({ tone: 'danger', message: describeError(t, failure) })
          }
        },
      },
    )
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <Card title={t('venueSettings.general')}>
        <div className={styles.fields}>
          <TextField
            label={t('venueSettings.name')}
            required
            maxLength={ORGANIZATION_NAME_MAX_LENGTH}
            value={name}
            error={message('name')}
            onChange={(change) => {
              setName(change.target.value)
              setError(null)
            }}
          />
          <SelectField
            label={t('venueSettings.language')}
            value={language}
            hint={t('venueSettings.languageHint')}
            onChange={(change) =>
              setLanguage(change.target.value as VenueLanguage)
            }
          >
            {LANGUAGES.map((option) => (
              <option key={option} value={option}>
                {t(`language.${option}`)}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>
      <Card
        title={t('venueSettings.contact')}
        subtitle={t('venueSettings.contactHint')}
      >
        <div className={styles.fields}>
          <TextField
            label={t('venueSettings.email')}
            type="email"
            value={email}
            error={message('contactEmail')}
            onChange={(change) => {
              setEmail(change.target.value)
              setError(null)
            }}
          />
          <TextField
            label={t('venueSettings.phone')}
            type="tel"
            maxLength={CONTACT_PHONE_MAX_LENGTH}
            value={phone}
            error={message('contactPhone')}
            onChange={(change) => {
              setPhone(change.target.value)
              setError(null)
            }}
          />
        </div>
      </Card>
      <div className={styles.actions}>
        <Button type="submit" icon={<Save />} loading={save.isPending}>
          {t('venueSettings.save')}
        </Button>
      </div>
    </form>
  )
}

/**
 * A venue's own details (V2.2, #8, no mockup; built like Event Settings):
 * its name, default language and the contact details its clients see (D117).
 * The Owner only; a Manager does not see this page (D112).
 */
export function VenueSettingsPage() {
  const { t } = useTranslation()
  const { organizationId = '' } = useParams()
  const workspace = useVenueWorkspace(organizationId)

  if (workspace.isPending) {
    return (
      <Card>
        <h1 className="visually-hidden">{t('common.loading')}</h1>
        <LoadingState />
      </Card>
    )
  }
  if (!workspace.data || !venueCan(workspace.data.role, 'MANAGE_SETTINGS')) {
    return <NotFoundPage />
  }
  return (
    <>
      <PageHeader
        title={t('venueNav.settings')}
        subtitle={t('venueSettings.subtitle')}
      />
      <SettingsForm
        key={workspace.data.organization.id}
        organization={workspace.data.organization}
      />
    </>
  )
}
