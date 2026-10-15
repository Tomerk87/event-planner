import { ValidationPipe, type INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
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
  // Rate limits count by client address, which a proxy must pass on.
  ;(app as NestExpressApplication).set('trust proxy', config.trustProxyHops)
  // Pictures arrive as data addresses (up to about 700 KB for an RSVP
  // background) and an import can carry 5,000 guests: well above Express's
  // 100 KB default.
  ;(app as NestExpressApplication).useBodyParser('json', { limit: '5mb' })
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
