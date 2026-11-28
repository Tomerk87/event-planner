import { Info, Plus, Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isDomainError } from '../../domain/errors.ts'
import type { Country } from '../../domain/phone.ts'
import { EVENT_LIMITS } from '../../domain/events.ts'
import {
  SPACE_ADDRESS_MAX_LENGTH,
  SPACE_MAX_TABLES,
  SPACE_NAME_MAX_LENGTH,
  type SpaceInput,
  type VenueSpace,
} from '../../domain/venues.ts'
import { getCurrentLanguage } from '../../i18n/i18n.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PlaceField } from '../../shared/ui/PlaceField.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { CoverPhotoField } from '../events/CoverPhotoField.tsx'
import {
  browserTimeZone,
  listTimeZones,
  timeZoneChoice,
} from '../events/eventForm.ts'
import styles from './SpaceDialog.module.css'
import { SpaceCover } from './SpaceCover.tsx'
import { useCreateSpace, useUpdateSpace } from './venueMutations.ts'

type Field = 'name' | 'address' | 'maxPeople' | 'maxTables' | 'timeZone'

interface Values {
  name: string
  address: string
  maxPeople: string
  maxTables: string
  timeZone: string
  photo: string | null
}

function valuesOf(space: VenueSpace | null): Values {
  return space
    ? {
        name: space.name,
        address: space.address,
        maxPeople: String(space.maxPeople),
        maxTables: space.maxTables === null ? '' : String(space.maxTables),
        timeZone: space.timeZone,
        photo: space.photo,
      }
    : {
        name: '',
        address: '',
        maxPeople: '',
        maxTables: '',
        timeZone: browserTimeZone(),
        photo: null,
      }
}

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN)

/** The fields a person needs to fix before saving, checked in the browser. */
function check(values: Values, otherNames: readonly string[]) {
  const errors: Partial<Record<Field, string>> = {}
  const name = values.name.trim()
  if (name === '' || name.length > SPACE_NAME_MAX_LENGTH) {
    errors.name = 'name'
  } else if (
    otherNames.some((other) => other.toLowerCase() === name.toLowerCase())
  ) {
    errors.name = 'nameDuplicate'
  }
  if (values.address.trim() === '') {
    errors.address = 'address'
  }
  const people = whole(values.maxPeople)
  if (!(people >= 1 && people <= EVENT_LIMITS.maxAttendees.max)) {
    errors.maxPeople = 'maxPeople'
  }
  const tables = values.maxTables.trim()
  if (
    tables !== '' &&
    !(whole(tables) >= 1 && whole(tables) <= SPACE_MAX_TABLES)
  ) {
    errors.maxTables = 'maxTables'
  }
  return errors
}

interface SpaceDialogProps {
  open: boolean
  onClose: () => void
  organizationId: string
  /** The space to edit, or null to create one. */
  space: VenueSpace | null
  /** The names of the venue's other spaces, which must differ. */
  otherNames: readonly string[]
  /** Favours address suggestions in the venue's country. */
  country: Country
  onSaved?: (space: VenueSpace) => void
}

/** Create or edit a space (V2.2, mockup #4). */
export function SpaceDialog({
  open,
  onClose,
  organizationId,
  space,
  otherNames,
  country,
  onSaved,
}: SpaceDialogProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const create = useCreateSpace(organizationId)
  const update = useUpdateSpace(organizationId)
  const [values, setValues] = useState(() => valuesOf(space))
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [timeZones] = useState(() => listTimeZones(values.timeZone))
  const editing = space !== null
  const pending = create.isPending || update.isPending

  const set = <Key extends keyof Values>(key: Key, value: Values[Key]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }
  const message = (field: Field) => {
    const key = errors[field]
    return key
      ? t(`spaceDialog.errors.${key}` as 'spaceDialog.errors.name', {
          max:
            field === 'maxTables'
              ? SPACE_MAX_TABLES
              : field === 'maxPeople'
                ? EVENT_LIMITS.maxAttendees.max
                : SPACE_NAME_MAX_LENGTH,
        })
      : undefined
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    const found = check(values, otherNames)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    const input: SpaceInput = {
      name: values.name,
      address: values.address,
      maxPeople: whole(values.maxPeople),
      maxTables:
        values.maxTables.trim() === '' ? null : whole(values.maxTables),
      timeZone: values.timeZone,
      photo: values.photo,
    }
    const done = (saved: VenueSpace) => {
      showToast({
        tone: 'success',
        message: t(editing ? 'spaceDialog.saved' : 'spaceDialog.created'),
      })
      onSaved?.(saved)
      onClose()
    }
    const fail = (error: unknown) => {
      const field = isDomainError(error, 'VALIDATION')
        ? (error.details?.['field'] as Field | undefined)
        : undefined
      if (field) {
        setErrors({
          [field]:
            error &&
            isDomainError(error) &&
            error.details?.['reason'] === 'duplicate'
              ? 'nameDuplicate'
              : field,
        })
      } else {
        setFailure(describeError(t, error))
      }
    }
    if (space) {
      update.mutate(
        { spaceId: space.id, input },
        { onSuccess: done, onError: fail },
      )
    } else {
      create.mutate(input, { onSuccess: done, onError: fail })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(editing ? 'spaceDialog.editTitle' : 'spaceDialog.createTitle')}
    >
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        {editing ? (
          <Notice title={t('spaceDialog.editNotice.title')}>
            {t('spaceDialog.editNotice.body')}
          </Notice>
        ) : (
          <p className={styles.intro}>{t('spaceDialog.intro')}</p>
        )}
        {failure && (
          <Notice tone="danger" title={failure} announce>
            {null}
          </Notice>
        )}
        <TextField
          label={t('spaceDialog.name')}
          required
          maxLength={SPACE_NAME_MAX_LENGTH}
          value={values.name}
          hint={t('spaceDialog.nameHint')}
          error={message('name')}
          onChange={(event) => set('name', event.target.value)}
        />
        <PlaceField
          label={t('spaceDialog.address')}
          maxLength={SPACE_ADDRESS_MAX_LENGTH}
          value={values.address}
          country={country}
          hint={t('spaceDialog.addressHint')}
          error={message('address')}
          onChange={(address) => set('address', address)}
        />
        <TextField
          label={t('spaceDialog.maxPeople')}
          required
          inputMode="numeric"
          value={values.maxPeople}
          hint={t('spaceDialog.maxPeopleHint', {
            max: EVENT_LIMITS.maxAttendees.max,
          })}
          error={message('maxPeople')}
          onChange={(event) => set('maxPeople', event.target.value)}
        />
        <div className={styles.labelled}>
          <TextField
            label={t('spaceDialog.maxTables')}
            inputMode="numeric"
            value={values.maxTables}
            hint={t('spaceDialog.maxTablesHint')}
            error={message('maxTables')}
            onChange={(event) => set('maxTables', event.target.value)}
          />
          <span className={styles.badge}>
            <Badge tone="info" icon={<Info />}>
              {t('spaceDialog.forInformation')}
            </Badge>
          </span>
        </div>
        <SelectField
          label={t('spaceDialog.timeZone')}
          required
          value={values.timeZone}
          hint={t('spaceDialog.timeZoneHint')}
          searchable
          emptyLabel={t('spaceDialog.timeZoneNoMatch')}
          onChange={(event) => set('timeZone', event.target.value)}
        >
          {timeZones.map((timeZone) => {
            const choice = timeZoneChoice(timeZone, getCurrentLanguage())
            return (
              <option
                key={timeZone}
                value={timeZone}
                data-keywords={choice.keywords}
              >
                {choice.label}
              </option>
            )
          })}
        </SelectField>
        <CoverPhotoField
          label={t('spaceDialog.photo')}
          value={values.photo}
          placeholder={
            <SpaceCover
              id={space?.id ?? 'new'}
              name={values.name || '·'}
              photo={null}
            />
          }
          onChange={(photo) => set('photo', photo)}
        />
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            loading={pending}
            icon={editing ? <Save /> : <Plus />}
          >
            {t(editing ? 'spaceDialog.save' : 'spaceDialog.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
