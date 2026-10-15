/**
 * Whether this deployment offers the public demo (`VITE_DEMO_ENABLED`). On
 * by default; turning it off hides Try Demo and changes nothing else.
 */
export function parseDemoEnabled(value: string | undefined): boolean {
  if (value === undefined || value === '' || value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  throw new Error(
    `Invalid VITE_DEMO_ENABLED "${value}". Expected true or false.`,
  )
}
