import { Inject, Injectable, Logger } from '@nestjs/common'
import argon2 from 'argon2'
import { APP_CONFIG, type AppConfig } from '../config.ts'
import {
  assertEmail,
  normalizeEmail,
  validateNewPassword,
  validateSignIn,
  validateSignUp,
  type SignInInput,
  type SignUpInput,
} from '../domain/accounts.ts'
import { DomainError } from '../domain/errors.ts'
import type { User } from '../domain/models.ts'
import { EmailService } from '../email/email.service.ts'
import * as emails from '../email/templates.ts'
import type { EmailLanguage } from '../email/templates.ts'
import type { EmailTokenKind } from '../generated/prisma/client.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toUser } from '../prisma/mappers.ts'
import { hashSessionToken, newSessionToken } from './session-token.ts'

export interface StartedSession {
  user: User
  token: string
  expiresAt: Date
}

type Transaction = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

/**
 * Accounts and sessions. Passwords are stored only as argon2 hashes.
 *
 * Invitations to an email become memberships once the account of that email
 * is verified (D89). With email off (the default, D88) there is no way to
 * verify, so an account counts as verified when it signs up, and its
 * invitations are accepted then.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth')
  // Compared against when an email has no account, so a failed sign-in takes
  // as long whether or not the account exists.
  private readonly dummyHash = argon2.hash('no account with this email')

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async signUp(
    input: SignUpInput,
    language: EmailLanguage = 'en',
  ): Promise<StartedSession> {
    const email = normalizeEmail(input.email)
    const existing = await this.prisma.user.findUnique({ where: { email } })
    const details = validateSignUp(input, existing ? [toUser(existing)] : [])
    const passwordHash = await argon2.hash(input.password)
    const verified = !this.email.enabled
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: details.name,
          email: details.email,
          passwordHash,
          emailVerifiedAt: verified ? new Date() : null,
        },
      })
      if (verified) {
        await this.acceptInvitations(tx, created.id, created.email)
      }
      return created
    })
    const session = await this.startSession(toUser(user))
    if (!verified) {
      await this.sendVerification(toUser(user), language)
    }
    return session
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

  /** Whether the account's email is verified; always so with email off. */
  async isEmailVerified(userId: string): Promise<boolean> {
    if (!this.email.enabled) {
      return true
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    })
    return Boolean(user?.emailVerifiedAt)
  }

  /** Sends the verification email again to a signed-in, unverified account. */
  async resendVerification(user: User, language: EmailLanguage): Promise<void> {
    this.assertEmailEnabled()
    if (await this.isEmailVerified(user.id)) {
      return
    }
    if (!this.email.allows('verify-email', user.email)) {
      throw new DomainError('TOO_MANY_REQUESTS')
    }
    await this.sendVerification(user, language)
  }

  /** Verifies the email of the link's account and accepts its invitations. */
  async verifyEmail(token: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const found = await this.useToken(tx, token, 'VERIFY_EMAIL')
      await this.markVerified(tx, found.userId)
    })
  }

  /**
   * Emails a reset link when the address has an account. The answer is the
   * same either way, and the email is sent after answering, so neither the
   * answer nor its timing tells whether an account exists.
   */
  async forgotPassword(
    emailInput: string,
    language: EmailLanguage,
  ): Promise<void> {
    this.assertEmailEnabled()
    const email = assertEmail(emailInput)
    void this.sendReset(email, language).catch((error: unknown) => {
      this.logger.error(
        `Could not prepare a reset email: ${error instanceof Error ? error.name : 'error'}`,
      )
    })
    return Promise.resolve()
  }

  /**
   * Sets a new password with a reset link. The link proves the email, and
   * every session of the account ends, so whoever knew the old password is
   * signed out everywhere.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    validateNewPassword(password)
    const passwordHash = await argon2.hash(password)
    await this.prisma.$transaction(async (tx) => {
      const found = await this.useToken(tx, token, 'RESET_PASSWORD')
      await tx.user.update({
        where: { id: found.userId },
        data: { passwordHash },
      })
      await tx.emailToken.updateMany({
        where: { userId: found.userId, kind: 'RESET_PASSWORD', usedAt: null },
        data: { usedAt: new Date() },
      })
      await tx.session.deleteMany({ where: { userId: found.userId } })
      await this.markVerified(tx, found.userId)
    })
  }

  private assertEmailEnabled(): void {
    if (!this.email.enabled) {
      throw new DomainError('NOT_FOUND', { entity: 'email' })
    }
  }

  private async sendVerification(
    user: User,
    language: EmailLanguage,
  ): Promise<void> {
    const token = await this.issueToken(
      user.id,
      'VERIFY_EMAIL',
      this.config.email.verifyHours * HOUR_MS,
    )
    await this.email.send({
      to: user.email,
      ...emails.verifyEmail(language, {
        name: user.name,
        url: this.email.link('/verify-email', { token }),
        hours: this.config.email.verifyHours,
      }),
    })
  }

  private async sendReset(
    email: string,
    language: EmailLanguage,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !this.email.allows('reset-password', email)) {
      return
    }
    const token = await this.issueToken(
      user.id,
      'RESET_PASSWORD',
      this.config.email.resetMinutes * MINUTE_MS,
    )
    await this.email.send({
      to: user.email,
      ...emails.resetPassword(language, {
        name: user.name,
        url: this.email.link('/reset-password', { token }),
        minutes: this.config.email.resetMinutes,
      }),
    })
  }

  private async issueToken(
    userId: string,
    kind: EmailTokenKind,
    lifetimeMs: number,
  ): Promise<string> {
    const token = newSessionToken()
    await this.prisma.emailToken.create({
      data: {
        userId,
        kind,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + lifetimeMs),
      },
    })
    return token
  }

  /** Marks a link used; an unknown, used or expired one is LINK_EXPIRED. */
  private async useToken(
    tx: Transaction,
    token: string,
    kind: EmailTokenKind,
  ): Promise<{ userId: string }> {
    const now = new Date()
    // One statement, so two clicks on the same link cannot both use it.
    const used = await tx.emailToken.updateManyAndReturn({
      where: {
        tokenHash: hashSessionToken(token),
        kind,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
      select: { userId: true },
    })
    if (used.length === 0) {
      throw new DomainError('LINK_EXPIRED')
    }
    return used[0]!
  }

  private async markVerified(tx: Transaction, userId: string): Promise<void> {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.emailVerifiedAt) {
      return
    }
    await tx.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    })
    await this.acceptInvitations(tx, user.id, user.email)
  }

  /** Access offered to this email becomes the account's membership. */
  private async acceptInvitations(
    tx: Transaction,
    userId: string,
    email: string,
  ): Promise<void> {
    const invitations = await tx.eventInvitation.findMany({ where: { email } })
    if (invitations.length === 0) {
      return
    }
    await tx.eventMembership.createMany({
      data: invitations.map(({ eventId, role }) => ({ eventId, userId, role })),
      skipDuplicates: true,
    })
    await tx.eventInvitation.deleteMany({ where: { email } })
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
