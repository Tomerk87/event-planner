import { Inject, Injectable } from '@nestjs/common'
import argon2 from 'argon2'
import { APP_CONFIG, type AppConfig } from '../config.ts'
import {
  normalizeEmail,
  validateSignIn,
  validateSignUp,
  type SignInInput,
  type SignUpInput,
} from '../domain/accounts.ts'
import { DomainError } from '../domain/errors.ts'
import type { User } from '../domain/models.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toUser } from '../prisma/mappers.ts'
import { hashSessionToken, newSessionToken } from './session-token.ts'

export interface StartedSession {
  user: User
  token: string
  expiresAt: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Accounts and sessions. Passwords are stored only as argon2 hashes. There is
 * no email verification yet (owner decision for the POC, PLAN.md Phase 17),
 * so invitations to an email are accepted when that email signs up.
 */
@Injectable()
export class AuthService {
  // Compared against when an email has no account, so a failed sign-in takes
  // as long whether or not the account exists.
  private readonly dummyHash = argon2.hash('no account with this email')

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async signUp(input: SignUpInput): Promise<StartedSession> {
    const email = normalizeEmail(input.email)
    const existing = await this.prisma.user.findUnique({ where: { email } })
    const details = validateSignUp(input, existing ? [toUser(existing)] : [])
    const passwordHash = await argon2.hash(input.password)
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: details.name, email: details.email, passwordHash },
      })
      // Access offered to this email before the account existed.
      const invitations = await tx.eventInvitation.findMany({
        where: { email: details.email },
      })
      if (invitations.length > 0) {
        await tx.eventMembership.createMany({
          data: invitations.map(({ eventId, role }) => ({
            eventId,
            userId: created.id,
            role,
          })),
        })
        await tx.eventInvitation.deleteMany({ where: { email: details.email } })
      }
      return created
    })
    return this.startSession(toUser(user))
  }

  async signIn(input: SignInInput): Promise<StartedSession> {
    const email = validateSignIn(input)
    const found = await this.prisma.user.findUnique({ where: { email } })
    const matches = await argon2.verify(
      found?.passwordHash ?? (await this.dummyHash),
      input.password,
    )
    if (!found || !matches) {
      throw new DomainError('INVALID_CREDENTIALS')
    }
    return this.startSession(toUser(found))
  }

  async signOut(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } })
  }

  /** The live session of a cookie's token, with its user; null otherwise. */
  async findSession(token: string): Promise<{ id: string; user: User } | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    })
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null
    }
    return { id: session.id, user: toUser(session.user) }
  }

  private async startSession(user: User): Promise<StartedSession> {
    const token = newSessionToken()
    const expiresAt = new Date(Date.now() + this.config.sessionDays * DAY_MS)
    await this.prisma.session.create({
      data: { tokenHash: hashSessionToken(token), userId: user.id, expiresAt },
    })
    return { user, token, expiresAt }
  }
}
