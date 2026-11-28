import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isDomainError } from '../../domain/errors.ts'
import {
  TEMPLATE_NAME_MAX_LENGTH,
  type LayoutTemplate,
} from '../../domain/venues.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import styles from './SpaceDialog.module.css'

interface TemplateNameDialogProps {
  mode: 'create' | 'rename'
  initialName?: string
  /** Saves the name; refused names come back as errors. */
  onSubmit: (name: string) => Promise<LayoutTemplate>
  onDone: (template: LayoutTemplate) => void
  onClose: () => void
  pending: boolean
}

/** Names a new layout template, or renames one (Phase 26). */
export function TemplateNameDialog({
  mode,
  initialName = '',
  onSubmit,
  onDone,
  onClose,
  pending,
}: TemplateNameDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const texts =
    mode === 'create'
      ? {
          title: t('templateEditor.createDialog.title'),
          label: t('templateEditor.createDialog.name'),
          submit: t('templateEditor.createDialog.create'),
        }
      : {
          title: t('templateEditor.renameDialog.title'),
          label: t('templateEditor.renameDialog.name'),
          submit: t('templateEditor.renameDialog.save'),
        }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '' || trimmed.length > TEMPLATE_NAME_MAX_LENGTH) {
      setError(
        t('templateEditor.errors.name', { max: TEMPLATE_NAME_MAX_LENGTH }),
      )
      return
    }
    onSubmit(trimmed).then(onDone, (failure: unknown) =>
      setError(
        isDomainError(failure, 'VALIDATION') &&
          failure.details?.['reason'] === 'duplicate'
          ? t('templateEditor.errors.nameDuplicate')
          : describeError(t, failure),
      ),
    )
  }

  return (
    <Dialog open onClose={onClose} title={texts.title}>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        {mode === 'create' && (
          <p className={styles.intro}>
            {t('templateEditor.createDialog.hint')}
          </p>
        )}
        <TextField
          label={texts.label}
          required
          maxLength={TEMPLATE_NAME_MAX_LENGTH}
          value={name}
          error={error ?? undefined}
          onChange={(change) => {
            setName(change.target.value)
            setError(null)
          }}
        />
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={pending}>
            {texts.submit}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
