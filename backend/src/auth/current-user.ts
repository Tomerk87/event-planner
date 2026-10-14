import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { User } from '../domain/models.ts'

/** A request that passed the session guard. */
export interface AuthenticatedRequest extends Request {
  user: User
  sessionId: string
}

/** The signed-in user of the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
)
