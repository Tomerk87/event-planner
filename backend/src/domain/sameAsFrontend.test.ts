import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontendDomain = path.resolve(here, '../../../frontend/src/domain')

/**
 * The backend applies the same business rules as the frontend's mock
 * provider, from a copy of frontend/src/domain. This keeps the two copies
 * identical: change a rule in both places, in the same change.
 */
describe.runIf(existsSync(frontendDomain))('domain rules', () => {
  const shared = readdirSync(here).filter(
    (file) =>
      file.endsWith('.ts') && existsSync(path.join(frontendDomain, file)),
  )

  it('are shared with the frontend', () => {
    expect(shared.length).toBeGreaterThan(20)
  })

  it.each(shared)('%s matches frontend/src/domain', (file) => {
    expect(readFileSync(path.join(here, file), 'utf8')).toBe(
      readFileSync(path.join(frontendDomain, file), 'utf8'),
    )
  })
})
