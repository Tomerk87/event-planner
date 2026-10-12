import type { TFunction } from 'i18next'
import { isDomainError } from '../domain/errors.ts'

/** A translated, user-facing explanation of a failed operation. */
export function describeError(t: TFunction, error: unknown): string {
  return isDomainError(error)
    ? t(`errors.${error.code}`, { ...error.details })
    : t('errors.UNKNOWN')
}
