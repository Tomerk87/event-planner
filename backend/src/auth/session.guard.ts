import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { DomainError } from '../domain/errors.ts'
import { AuthService } from './auth.service.ts'
import type { AuthenticatedRequest } from './current-user.ts'
import { IS_PUBLIC } from './public.decorator.ts'
import { SESSION_COOKIE } from './session-token.ts'

/**
 * Applied to every route: finds the user of the session cookie and refuses
 * the request without one, unless the route is marked `@Public()`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const cookies = request.cookies as Record<string, unknown> | undefined
    const token = cookies?.[SESSION_COOKIE]
    const session =
      typeof token === 'string' ? await this.auth.findSession(token) : null
    if (session) {
      request.user = session.user
      request.sessionId = session.id
      return true
    }
    if (isPublic) {
      return true
    }
    throw new DomainError('UNAUTHENTICATED')
  }
}
