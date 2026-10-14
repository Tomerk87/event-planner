import { ImageUp, Trash2 } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { COVER_IMAGE_MAX_LENGTH } from '../../domain/events.ts'
import {
  checkImageFile,
  IMAGE_TYPES,
  shrinkImage,
  type ImageProblem,
} from '../../shared/imageTools.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { EventCover } from '../../shared/ui/EventCover.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import styles from './CoverPhotoField.module.css'

interface CoverPhotoFieldProps {
  /** The event, for its generated cover; leave out for a new event. */
  eventId?: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
}

/**
 * The event's photo, shown on its card and in the event selector. Without
 * one the event keeps its generated cover. The picture is shrunk in the
 * browser before it is kept.
 */
export function CoverPhotoField({
  eventId = 'new',
  value,
  onChange,
  disabled = false,
}: CoverPhotoFieldProps) {
  const { t } = useTranslation()
  const labelId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [problem, setProblem] = useState<ImageProblem | null>(null)

  async function handleFile(change: ChangeEvent<HTMLInputElement>) {
    const file = change.target.files?.[0]
    // Lets the same file be chosen again after it was removed.
    change.target.value = ''
    if (!file) {
      return
    }
    const found = checkImageFile(file)
    setProblem(found)
    if (found) {
      return
    }
    try {
      onChange(
        await shrinkImage(file, {
          maxSide: 1200,
          maxLength: COVER_IMAGE_MAX_LENGTH,
        }),
      )
    } catch {
      setProblem('failed')
    }
  }

  return (
    <div className={styles.field} role="group" aria-labelledby={labelId}>
      <p id={labelId} className={styles.label}>
        {t('events.form.photo.label')}
      </p>
      <div className={styles.row}>
        <div className={styles.preview}>
          <EventCover eventId={eventId} image={value} />
        </div>
        <div className={styles.controls}>
          {!disabled && (
            <div className={styles.buttons}>
              <input
                ref={fileRef}
                type="file"
                className="visually-hidden"
                tabIndex={-1}
                aria-hidden="true"
                accept={IMAGE_TYPES.join(',')}
                data-testid="cover-file"
                onChange={(change) => void handleFile(change)}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<ImageUp />}
                onClick={() => fileRef.current?.click()}
              >
                {t(
                  value
                    ? 'events.form.photo.change'
                    : 'events.form.photo.upload',
                )}
              </Button>
              {value && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 />}
                  onClick={() => {
                    setProblem(null)
                    onChange(null)
                  }}
                >
                  {t('events.form.photo.remove')}
                </Button>
              )}
            </div>
          )}
          <p className={styles.hint}>
            {t(value ? 'events.form.photo.hint' : 'events.form.photo.none')}
          </p>
        </div>
      </div>
      {problem && (
        <Notice
          tone="danger"
          title={t(`rsvpSettings.background.errors.${problem}`)}
          announce
        />
      )}
    </div>
  )
}
