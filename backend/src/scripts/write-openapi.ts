import { NestFactory } from '@nestjs/core'
import { writeFileSync } from 'node:fs'
import { createAppModule } from '../app.module.ts'
import { loadConfig } from '../config.ts'
import { createOpenApiDocument, setupApp } from '../setup-app.ts'

/**
 * Writes openapi.json, the API contract the frontend's API provider is
 * generated from (PLAN.md Phase 16). Needs no database connection.
 */
const config = loadConfig({
  DATABASE_URL: 'postgresql://unused@localhost/unused',
  CORS_ORIGIN: 'http://localhost:5173',
})
const app = await NestFactory.create(createAppModule(config), {
  logger: false,
  abortOnError: false,
})
setupApp(app, config)
await app.init().catch(() => undefined)
writeFileSync(
  'openapi.json',
  `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`,
)
await app.close().catch(() => undefined)
console.log('Wrote openapi.json')
