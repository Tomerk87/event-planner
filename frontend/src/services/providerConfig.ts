/**
 * A build switch that is on unless set to "false". Anything other than
 * "true" or "false" stops the application, so a typo is not taken silently.
 */
function parseSwitch(name: string, value: string | undefined): boolean {
  if (value === undefined || value === '' || value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  throw new Error(`Invalid ${name} "${value}". Expected true or false.`)
}

/**
 * Whether this deployment offers the public demo (`VITE_DEMO_ENABLED`). On
 * by default; turning it off hides Try Demo and changes nothing else.
 */
export function parseDemoEnabled(value: string | undefined): boolean {
  return parseSwitch('VITE_DEMO_ENABLED', value)
}

/**
 * Whether this deployment has real accounts on the server
 * (`VITE_ACCOUNTS_ENABLED`). On by default; turning it off makes a demo-only
 * site that needs no server (D102): no Sign In or Sign Up, and no request to
 * the API.
 */
export function parseAccountsEnabled(value: string | undefined): boolean {
  return parseSwitch('VITE_ACCOUNTS_ENABLED', value)
}
