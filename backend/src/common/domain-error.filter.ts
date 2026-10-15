import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Response } from 'express'
import { DomainError, type DomainErrorCode } from '../domain/errors.ts'
import { Prisma } from '../generated/prisma/client.ts'

const STATUS: Record<DomainErrorCode, HttpStatus> = {
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  EVENT_READ_ONLY: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  VALIDATION: HttpStatus.BAD_REQUEST,
  INVALID_PHONE: HttpStatus.BAD_REQUEST,
  INVALID_ATTENDEE_COUNT: HttpStatus.BAD_REQUEST,
  DUPLICATE_PHONE: HttpStatus.CONFLICT,
  GUEST_NOT_APPROVED: HttpStatus.CONFLICT,
  TABLE_FULL: HttpStatus.CONFLICT,
  DUPLICATE_TABLE_NUMBER: HttpStatus.CONFLICT,
  LAST_OWNER: HttpStatus.CONFLICT,
  SELF_PERMISSION: HttpStatus.CONFLICT,
  ALREADY_MEMBER: HttpStatus.CONFLICT,
  ALREADY_INVITED: HttpStatus.CONFLICT,
  RSVP_CLOSED: HttpStatus.CONFLICT,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  ACCOUNT_NOT_FOUND: HttpStatus.NOT_FOUND,
  UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
}

/** The body of every error response: a stable code the frontend translates. */
export interface ErrorBody {
  code: DomainErrorCode
  details: Record<string, string | number>
}

/**
 * Turns every failure into `{ code, details }` with a matching HTTP status.
 * Unexpected errors are logged and reported as UNAVAILABLE, without a stack
 * trace or any internal detail in the response.
 */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors')

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const { status, body } = this.describe(error)
    response.status(status).json(body)
  }

  private describe(error: unknown): { status: number; body: ErrorBody } {
    if (error instanceof DomainError) {
      return {
        status: STATUS[error.code],
        body: { code: error.code, details: { ...error.details } },
      }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return {
        status: HttpStatus.NOT_FOUND,
        body: { code: 'NOT_FOUND', details: {} },
      }
    }
    if (error instanceof HttpException) {
      const status = error.getStatus()
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        return { status, body: { code: 'TOO_MANY_REQUESTS', details: {} } }
      }
      if (status === HttpStatus.NOT_FOUND) {
        return { status, body: { code: 'NOT_FOUND', details: {} } }
      }
      if (status === HttpStatus.SERVICE_UNAVAILABLE) {
        return { status, body: { code: 'UNAVAILABLE', details: {} } }
      }
      if (status < 500) {
        return { status, body: { code: 'VALIDATION', details: {} } }
      }
    }
    // A request the body parser refused, such as one that is too large.
    const parserStatus = (error as { status?: unknown } | null)?.status
    if (
      typeof parserStatus === 'number' &&
      parserStatus >= 400 &&
      parserStatus < 500
    ) {
      return { status: parserStatus, body: { code: 'VALIDATION', details: {} } }
    }
    this.logger.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    )
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'UNAVAILABLE', details: {} },
    }
  }
}
