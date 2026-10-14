import { ValidationPipe, type INestApplication } from '@nestjs/common'
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import type { AppConfig } from './config.ts'
import { SESSION_COOKIE } from './auth/session-token.ts'

/** Settings shared by the running server and the tests. */
export function setupApp(app: INestApplication, config: AppConfig): void {
  app.setGlobalPrefix('api')
  app.use(cookieParser())
  app.enableCors({ origin: config.corsOrigin, credentials: true })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
}

/** The OpenAPI description of the API, served at /api/docs and saved as openapi.json. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Event Planner API')
      .setDescription(
        'Errors are returned as { code, details }; the codes are those of src/domain/errors.ts.',
      )
      .setVersion('1')
      .addCookieAuth(SESSION_COOKIE)
      .build(),
  )
}
