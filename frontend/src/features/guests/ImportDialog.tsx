import {
  CircleCheck,
  Download,
  FileSpreadsheet,
  TriangleAlert,
} from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toCsv } from '../../domain/csv.ts'
import { isDomainError } from '../../domain/errors.ts'
import {
  detectMapping,
  IMPORT_FIELDS,
  isMappingComplete,
  MAX_IMPORT_ROWS,
  planGuestImport,
  REQUIRED_IMPORT_FIELDS,
  type ColumnMapping,
  type ImportField,
  type ImportPlan,
} from '../../domain/guestImport.ts'
import type { Event, Guest } from '../../domain/models.ts'
import { useFormatters } from '../../i18n/format.ts'
import type { ImportOutcome } from '../../services/contracts/index.ts'
import { useServices } from '../../services/servicesContext.ts'
import { downloadBlob, safeFileName } from '../../shared/download.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { Checkbox } from '../../shared/ui/Checkbox.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField } from '../../shared/ui/Field.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { ACCEPTED_FILES } from './guestFiles.ts'
import { useImportGuests } from './guestQueries.ts'
import styles from './Guests.module.css'

const PREVIEW_ROWS = 100
const UNMAPPED = 'NONE'

type Step =
  | { name: 'choose' }
  | { name: 'map'; fileName: string; rows: string[][] }
  | { name: 'preview'; fileName: string; rows: string[][]; plan: ImportPlan }
  | { name: 'done'; plan: ImportPlan; outcome: ImportOutcome }

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  event: Event
  /** Active guests, used to spot phones the event already has. */
  guests: readonly Guest[]
}

function ImportSteps({
  eventId,
  event,
  guests,
  onClose,
}: Omit<ImportDialogProps, 'open'>) {
  const { t } = useTranslation()
  const format = useFormatters()
  const fileInputId = useId()
  const importGuests = useImportGuests(eventId)
  const { files } = useServices()
  const [step, setStep] = useState<Step>({ name: 'choose' })
  const [hasHeadings, setHasHeadings] = useState(true)
  const [mapping, setMapping] = useState<ColumnMapping>(detectMapping([]))
  const [failure, setFailure] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  function fileError(error: unknown): string {
    if (isDomainError(error, 'VALIDATION')) {
      const { field } = error.details
      if (field === 'fileSize') {
        return t('guests.import.errors.fileSize')
      }
      if (field === 'fileType') {
        return t('guests.import.errors.fileType')
      }
      if (field === 'fileContent') {
        return t('guests.import.errors.fileContent')
      }
      if (field === 'rows') {
        return t('guests.import.errors.tooManyRows', {
          max: format.number(MAX_IMPORT_ROWS),
        })
      }
    }
    return describeError(t, error)
  }

  async function chooseFile(file: File | undefined) {
    if (!file) {
      return
    }
    setFailure(null)
    setReading(true)
    try {
      const rows = await files.readGuestFile(eventId, file)
      if (rows.length === 0) {
        setFailure(t('guests.import.errors.empty'))
        return
      }
      setHasHeadings(true)
      setMapping(detectMapping(rows[0] ?? []))
      setStep({ name: 'map', fileName: file.name, rows })
    } catch (error) {
      setFailure(fileError(error))
    } finally {
      setReading(false)
    }
  }

  function downloadTemplate() {
    downloadBlob(
      new Blob(
        [
          toCsv([
            IMPORT_FIELDS.map((field) => t(`guests.import.fields.${field}`)),
          ]),
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
      `${safeFileName(t('guests.import.templateName'))}.csv`,
    )
  }

  function toPreview(fileName: string, rows: string[][]) {
    setFailure(null)
    try {
      setStep({
        name: 'preview',
        fileName,
        rows,
        plan: planGuestImport(
          hasHeadings ? rows.slice(1) : rows,
          mapping,
          guests,
          event,
          hasHeadings ? 2 : 1,
        ),
      })
    } catch (error) {
      setFailure(fileError(error))
    }
  }

  function runImport(plan: ImportPlan) {
    setFailure(null)
    importGuests.mutate(
      plan.rows.flatMap((row) => row.input ?? []),
      {
        onSuccess: (outcome) => setStep({ name: 'done', plan, outcome }),
        onError: (error) => setFailure(describeError(t, error)),
      },
    )
  }

  function downloadSkipped(plan: ImportPlan) {
    const skipped = plan.rows.filter((row) => row.outcome === 'error')
    downloadBlob(
      new Blob(
        [
          toCsv([
            [
              t('guests.import.row'),
              ...IMPORT_FIELDS.map((field) =>
                t(`guests.import.fields.${field}`),
              ),
              t('guests.import.problem'),
            ],
            ...skipped.map((row) => [
              row.rowNumber,
              ...IMPORT_FIELDS.map((field) => row.values[field]),
              row.error ? t(`guests.import.rowErrors.${row.error}`) : '',
            ]),
          ]),
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
      `${safeFileName(t('guests.import.skippedName'))}.csv`,
    )
  }

  const alert = failure && <Notice tone="danger" title={failure} announce />

  if (step.name === 'choose') {
    return (
      <div className={styles.form}>
        {alert}
        <p>{t('guests.import.intro')}</p>
        <ul className={styles.bullets}>
          <li>{t('guests.import.ruleRequired')}</li>
          <li>{t('guests.import.rulePhones')}</li>
          <li>{t('guests.import.ruleDuplicates')}</li>
          <li>
            {t('guests.import.ruleLimit', {
              max: format.number(MAX_IMPORT_ROWS),
            })}
          </li>
        </ul>
        <div className={styles.fileChooser}>
          <label htmlFor={fileInputId} className={styles.fileLabel}>
            <FileSpreadsheet aria-hidden="true" />
            {t('guests.import.choose')}
          </label>
          <input
            id={fileInputId}
            className={styles.fileInput}
            type="file"
            accept={ACCEPTED_FILES}
            disabled={reading}
            onChange={(change) => {
              void chooseFile(change.target.files?.[0])
              change.target.value = ''
            }}
          />
        </div>
        <div className={styles.formActions}>
          <Button
            variant="ghost"
            icon={<Download />}
            onClick={downloadTemplate}
          >
            {t('guests.import.template')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    )
  }

  if (step.name === 'map') {
    const [first = []] = step.rows
    const width = Math.max(...step.rows.slice(0, 50).map((row) => row.length))
    const columnLabel = (index: number) =>
      hasHeadings && (first[index] ?? '').trim() !== ''
        ? (first[index] ?? '')
        : t('guests.import.columnNumber', { number: format.number(index + 1) })
    return (
      <div className={styles.form}>
        {alert}
        <p>
          {t('guests.import.mapIntro', {
            file: step.fileName,
            rows: format.number(step.rows.length),
          })}
        </p>
        <Checkbox
          label={t('guests.import.hasHeadings')}
          checked={hasHeadings}
          onChange={(change) => setHasHeadings(change.target.checked)}
        />
        <div className={styles.formRow}>
          {IMPORT_FIELDS.map((field: ImportField) => (
            <SelectField
              key={field}
              label={t(`guests.import.fields.${field}`)}
              required={REQUIRED_IMPORT_FIELDS.includes(field)}
              value={
                mapping[field] === null ? UNMAPPED : String(mapping[field])
              }
              onChange={(change) =>
                setMapping((current) => ({
                  ...current,
                  [field]:
                    change.target.value === UNMAPPED
                      ? null
                      : Number(change.target.value),
                }))
              }
            >
              <option value={UNMAPPED}>{t('guests.import.notInFile')}</option>
              {Array.from({ length: width }, (_, index) => (
                <option key={index} value={index}>
                  {columnLabel(index)}
                </option>
              ))}
            </SelectField>
          ))}
        </div>
        {!isMappingComplete(mapping) && (
          <p className={styles.muted}>{t('guests.import.mapRequired')}</p>
        )}
        <div className={styles.formActions}>
          <Button variant="ghost" onClick={() => setStep({ name: 'choose' })}>
            {t('guests.import.back')}
          </Button>
          <Button
            disabled={!isMappingComplete(mapping)}
            onClick={() => toPreview(step.fileName, step.rows)}
          >
            {t('guests.import.preview')}
          </Button>
        </div>
      </div>
    )
  }

  if (step.name === 'preview') {
    const { plan } = step
    return (
      <div className={styles.form}>
        {alert}
        <div className={styles.importSummary}>
          <Badge tone="success" icon={<CircleCheck />}>
            {t('guests.import.willImport', {
              count: format.number(plan.valid),
            })}
          </Badge>
          {plan.invalid > 0 && (
            <Badge tone="danger" icon={<TriangleAlert />}>
              {t('guests.import.willSkip', {
                count: format.number(plan.invalid),
              })}
            </Badge>
          )}
        </div>
        <div className={styles.previewScroll} tabIndex={0}>
          <table className={styles.previewTable}>
            <caption className="visually-hidden">
              {t('guests.import.previewCaption')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('guests.import.row')}</th>
                {IMPORT_FIELDS.map((field) => (
                  <th key={field} scope="col">
                    {t(`guests.import.fields.${field}`)}
                  </th>
                ))}
                <th scope="col">{t('guests.import.result')}</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.slice(0, PREVIEW_ROWS).map((row) => (
                <tr key={row.rowNumber}>
                  <td className={styles.previewNumber}>
                    {format.number(row.rowNumber)}
                  </td>
                  <td>{row.values.firstName}</td>
                  <td>{row.values.lastName}</td>
                  <td>
                    <LtrText>{row.values.phone}</LtrText>
                  </td>
                  <td className={styles.previewNumber}>
                    {row.input
                      ? format.number(row.input.allowedAttendees)
                      : row.values.allowedAttendees}
                  </td>
                  <td>{row.values.group}</td>
                  <td>
                    {row.error ? (
                      <span className={styles.rowError}>
                        {t(`guests.import.rowErrors.${row.error}`)}
                      </span>
                    ) : (
                      t(`guests.import.outcome.${row.outcome}`)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {plan.rows.length > PREVIEW_ROWS && (
          <p className={styles.muted}>
            {t('guests.import.previewLimit', {
              shown: format.number(PREVIEW_ROWS),
              total: format.number(plan.rows.length),
            })}
          </p>
        )}
        <div className={styles.formActions}>
          <Button
            variant="ghost"
            onClick={() =>
              setStep({ name: 'map', fileName: step.fileName, rows: step.rows })
            }
          >
            {t('guests.import.back')}
          </Button>
          <Button
            disabled={plan.valid === 0}
            loading={importGuests.isPending}
            onClick={() => runImport(plan)}
          >
            {t('guests.import.confirm', { count: format.number(plan.valid) })}
          </Button>
        </div>
      </div>
    )
  }

  const { plan, outcome } = step
  return (
    <div className={styles.form}>
      <Notice tone="success" title={t('guests.import.doneTitle')} announce>
        {t('guests.import.doneBody', {
          created: format.number(outcome.created),
          restored: format.number(outcome.restored),
          skipped: format.number(plan.invalid),
        })}
      </Notice>
      <div className={styles.formActions}>
        {plan.invalid > 0 && (
          <Button
            variant="secondary"
            icon={<Download />}
            onClick={() => downloadSkipped(plan)}
          >
            {t('guests.import.downloadSkipped')}
          </Button>
        )}
        <Button onClick={onClose}>{t('guests.import.finish')}</Button>
      </div>
    </div>
  )
}

/** Adds guests from a CSV or Excel file, in four steps. */
export function ImportDialog({ open, onClose, ...rest }: ImportDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} title={t('guests.import.title')} wide>
      <ImportSteps onClose={onClose} {...rest} />
    </Dialog>
  )
}
