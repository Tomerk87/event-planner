import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isDomainError } from '../../domain/errors.ts'
import { TABLE_SHAPES, type TableShape } from '../../domain/models.ts'
import { TABLE_LIMITS } from '../../domain/seating.ts'
import type { SeatedTable } from '../../domain/tableList.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { toInteger } from '../events/eventForm.ts'
import formStyles from '../guests/Guests.module.css'
import { useCreateTable, useUpdateTable } from './tableQueries.ts'

const DEFAULT_CAPACITY = 10

type FieldError =
  { field: 'number'; reason: 'range' | 'duplicate' } | { field: 'capacity' }

interface TableDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  tables: readonly SeatedTable[]
  /** The table being edited; leave out to add a new one. */
  editing?: SeatedTable | null
  /** Offered while editing: asks to delete the table (D105). */
  onDelete?: (item: SeatedTable) => void
}

function isInRange(value: number, range: { min: number; max: number }) {
  return Number.isInteger(value) && value >= range.min && value <= range.max
}

function TableForm({
  eventId,
  tables,
  editing,
  onDelete,
  onClose,
}: Omit<TableDialogProps, 'open'>) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const create = useCreateTable(eventId)
  const update = useUpdateTable(eventId)
  // A new table continues the numbering and repeats the last table's shape.
  const last = tables.reduce<SeatedTable | null>(
    (highest, item) =>
      highest === null || item.table.number > highest.table.number
        ? item
        : highest,
    null,
  )
  const [number, setNumber] = useState(
    String(editing?.table.number ?? (last ? last.table.number + 1 : 1)),
  )
  const [capacity, setCapacity] = useState(
    String(editing?.table.capacity ?? DEFAULT_CAPACITY),
  )
  const [shape, setShape] = useState<TableShape>(
    editing?.table.shape ?? last?.table.shape ?? 'CIRCLE',
  )
  const [fieldError, setFieldError] = useState<FieldError | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const isSaving = create.isPending || update.isPending
  const chairs = toInteger(capacity)
  const seated = editing?.assigned ?? 0

  function fail(error: unknown) {
    if (isDomainError(error, 'DUPLICATE_TABLE_NUMBER')) {
      return setFieldError({ field: 'number', reason: 'duplicate' })
    }
    if (isDomainError(error, 'VALIDATION')) {
      if (error.details.field === 'number') {
        return setFieldError({ field: 'number', reason: 'range' })
      }
      if (error.details.field === 'capacity') {
        return setFieldError({ field: 'capacity' })
      }
    }
    setFailure(describeError(t, error))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFieldError(null)
    setFailure(null)
    const input = { number: toInteger(number), capacity: chairs, shape }
    if (!isInRange(input.number, TABLE_LIMITS.number)) {
      return setFieldError({ field: 'number', reason: 'range' })
    }
    if (!isInRange(input.capacity, TABLE_LIMITS.capacity)) {
      return setFieldError({ field: 'capacity' })
    }
    const options = {
      onSuccess: () => {
        showToast({
          tone: 'success' as const,
          message: t(editing ? 'layout.form.saved' : 'layout.form.added', {
            number: format.number(input.number),
          }),
        })
        onClose()
      },
      onError: fail,
    }
    if (editing) {
      update.mutate({ tableId: editing.table.id, input }, options)
    } else {
      create.mutate(input, options)
    }
  }

  return (
    <form className={formStyles.form} noValidate onSubmit={handleSubmit}>
      {failure && <Notice tone="danger" title={failure} announce />}
      <div className={formStyles.formRow}>
        <TextField
          label={t('layout.form.number')}
          type="number"
          inputMode="numeric"
          required
          min={TABLE_LIMITS.number.min}
          max={TABLE_LIMITS.number.max}
          value={number}
          error={
            fieldError?.field === 'number'
              ? fieldError.reason === 'duplicate'
                ? t('layout.form.errors.duplicate', { number })
                : t('layout.form.errors.number', TABLE_LIMITS.number)
              : undefined
          }
          onChange={(event) => {
            setNumber(event.target.value)
            setFieldError((current) =>
              current?.field === 'number' ? null : current,
            )
          }}
        />
        <TextField
          label={t('layout.form.capacity')}
          type="number"
          inputMode="numeric"
          required
          min={TABLE_LIMITS.capacity.min}
          max={TABLE_LIMITS.capacity.max}
          value={capacity}
          hint={t('layout.form.capacityHint')}
          error={
            fieldError?.field === 'capacity'
              ? t('layout.form.errors.capacity', TABLE_LIMITS.capacity)
              : undefined
          }
          onChange={(event) => {
            setCapacity(event.target.value)
            setFieldError((current) =>
              current?.field === 'capacity' ? null : current,
            )
          }}
        />
      </div>
      <SelectField
        label={t('layout.form.shape')}
        value={shape}
        onChange={(event) => setShape(event.target.value as TableShape)}
      >
        {TABLE_SHAPES.map((option) => (
          <option key={option} value={option}>
            {t(`layout.shapes.${option}`)}
          </option>
        ))}
      </SelectField>
      {Number.isInteger(chairs) && chairs >= 1 && chairs < seated && (
        <Notice tone="warning" title={t('layout.form.belowSeated.title')}>
          {t('layout.form.belowSeated.body', {
            seated: format.number(seated),
            over: format.number(seated - chairs),
          })}
        </Notice>
      )}
      <div className={formStyles.formActions}>
        {editing && onDelete && (
          <Button
            variant="danger"
            icon={<Trash2 />}
            className={formStyles.formStartAction}
            onClick={() => onDelete(editing)}
          >
            {t('layout.selected.delete')}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={isSaving}>
          {t(editing ? 'layout.form.save' : 'layout.form.add')}
        </Button>
      </div>
    </form>
  )
}

export function TableDialog({
  open,
  onClose,
  editing,
  ...rest
}: TableDialogProps) {
  const { t } = useTranslation()
  const format = useFormatters()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        editing
          ? t('layout.form.editTitle', {
              number: format.number(editing.table.number),
            })
          : t('layout.form.addTitle')
      }
    >
      <TableForm editing={editing} onClose={onClose} {...rest} />
    </Dialog>
  )
}
