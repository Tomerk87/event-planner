import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import { createAppModule } from './app.module.ts'
import { loadConfig } from './config.ts'
import { createOpenApiDocument, setupApp } from './setup-app.ts'

try {
  process.loadEnvFile()
} catch {
  // No .env file: the environment provides the settings.
}

const config = loadConfig()
const app = await NestFactory.create(createAppModule(config), {
  logger: config.production ? ['log', 'warn', 'error'] : undefined,
})
setupApp(app, config)
SwaggerModule.setup('api/docs', app, () => createOpenApiDocument(app))
await app.listen(config.port)
new Logger('Bootstrap').log(`API listening on port ${config.port}`)
