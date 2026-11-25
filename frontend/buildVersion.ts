import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

/** The frontend's version and the commit it is built from (D107). */
export interface BuildVersion {
  version: string
  commit: string | null
}

/** The commit: given to the Docker build, set by Netlify, or read from git. */
function readCommit(env: NodeJS.ProcessEnv): string | null {
  const given = env['GIT_COMMIT']?.trim() || env['COMMIT_REF']?.trim()
  if (given) {
    return given.slice(0, 7)
  }
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/** Reads VERSION, raised by the Version workflow when a frontend change is merged. */
export function readBuildVersion(
  env: NodeJS.ProcessEnv = process.env,
): BuildVersion {
  const version = readFileSync(
    new URL('./VERSION', import.meta.url),
    'utf8',
  ).trim()
  if (!/^\d+\.\d+$/.test(version)) {
    throw new Error(`VERSION must be MAJOR.MINOR, such as 1.0: "${version}"`)
  }
  return { version, commit: readCommit(env) }
}

/** The constants the application reads (declared in src/vite-env.d.ts). */
export function versionDefines(build: BuildVersion): Record<string, string> {
  return {
    __APP_VERSION__: JSON.stringify(build.version),
    __APP_COMMIT__: JSON.stringify(build.commit),
  }
}

/** Serves /version.json in development and writes it into the build. */
export function versionFile(build: BuildVersion): Plugin {
  const body = `${JSON.stringify(build)}\n`
  return {
    name: 'version-file',
    configureServer(server) {
      server.middlewares.use('/version.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-cache')
        response.end(body)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: body })
    },
  }
}
