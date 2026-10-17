/**
 * A form's errors without the one for a field the person has just edited
 * (D104): the message no longer describes what is typed, and saving checks
 * the field again. The same object is returned when there is nothing to
 * remove, so typing in a field without an error re-renders nothing.
 */
export function withoutError<Errors extends object>(
  errors: Errors,
  field: keyof Errors | string,
): Errors {
  if (!(field in errors)) {
    return errors
  }
  const rest = { ...errors } as Record<string, unknown>
  delete rest[field as string]
  return rest as Errors
}
