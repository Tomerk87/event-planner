import { Injectable } from '@nestjs/common'
import { EventAccessService } from '../access/event-access.service.ts'
import { assertEmail } from '../domain/accounts.ts'
import { DomainError } from '../domain/errors.ts'
import type {
  EventInvitation,
  EventMembership,
  User,
} from '../domain/models.ts'
import {
  assertCanChangeInvitation,
  assertCanChangeMembership,
} from '../domain/permissions.ts'
import { EVENT_ROLES, type EventRole } from '../domain/roles.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toInvitation, toUser } from '../prisma/mappers.ts'

export interface Member {
  user: User
  role: EventRole
  isCurrentUser: boolean
}

export interface EventAccessList {
  members: Member[]
  invitations: EventInvitation[]
}

export type InviteResult =
  | { kind: 'member'; member: Member }
  | { kind: 'invitation'; invitation: EventInvitation }

const ROLE_ORDER: Record<EventRole, number> = { OWNER: 0, ADMIN: 1, VIEWER: 2 }

function assertRole(role: string): asserts role is EventRole {
  if (!(EVENT_ROLES as readonly string[]).includes(role)) {
    throw new DomainError('VALIDATION', { field: 'role' })
  }
}

/**
 * Event memberships and pending invitations, with the rules of PRD section
 * 3.2: Admins handle Admins and Viewers only, nobody changes their own
 * permission, every event keeps an Owner, and a past event's permissions are
 * changed by an Owner only. Accounts are never listed or searched.
 */
@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
  ) {}

  async list(eventId: string, user: User): Promise<EventAccessList> {
    await this.access.authorize(eventId, user, 'VIEW_PERMISSIONS')
    const [memberships, invitations] = await Promise.all([
      this.prisma.eventMembership.findMany({
        where: { eventId },
        include: { user: true },
      }),
      this.prisma.eventInvitation.findMany({
        where: { eventId },
        orderBy: { email: 'asc' },
      }),
    ])
    return {
      members: memberships
        .map((membership) => ({
          user: toUser(membership.user),
          role: membership.role,
          isCurrentUser: membership.userId === user.id,
        }))
        .sort(
          (a, b) =>
            ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
            a.user.name.localeCompare(b.user.name),
        ),
      invitations: invitations.map(toInvitation),
    }
  }

  async invite(
    eventId: string,
    emailInput: string,
    role: string,
    user: User,
  ): Promise<InviteResult> {
    const { actor } = await this.access.authorize(
      eventId,
      user,
      'MANAGE_PERMISSIONS',
    )
    const email = assertEmail(emailInput)
    assertRole(role)
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.user.findUnique({ where: { email } })
      if (account) {
        const memberships = await this.memberships(tx, eventId)
        if (
          memberships.some((membership) => membership.userId === account.id)
        ) {
          throw new DomainError('ALREADY_MEMBER')
        }
        assertCanChangeMembership(actor, memberships, {
          eventId,
          userId: account.id,
          newRole: role,
        })
        await tx.eventMembership.create({
          data: { eventId, userId: account.id, role },
        })
        return {
          kind: 'member' as const,
          member: { user: toUser(account), role, isCurrentUser: false },
        }
      }
      const existing = await tx.eventInvitation.findUnique({
        where: { eventId_email: { eventId, email } },
      })
      if (existing) {
        throw new DomainError('ALREADY_INVITED')
      }
      assertCanChangeInvitation(actor, { currentRole: null, newRole: role })
      const created = await tx.eventInvitation.create({
        data: { eventId, email, role },
      })
      return { kind: 'invitation' as const, invitation: toInvitation(created) }
    })
  }

  async changeRole(
    eventId: string,
    userId: string,
    role: string,
    user: User,
  ): Promise<Member> {
    const { actor } = await this.access.authorize(
      eventId,
      user,
      'MANAGE_PERMISSIONS',
    )
    assertRole(role)
    return this.prisma.$transaction(async (tx) => {
      const memberships = await this.memberships(tx, eventId)
      if (!memberships.some((membership) => membership.userId === userId)) {
        throw new DomainError('NOT_FOUND', { entity: 'membership' })
      }
      assertCanChangeMembership(actor, memberships, {
        eventId,
        userId,
        newRole: role,
      })
      const updated = await tx.eventMembership.update({
        where: { eventId_userId: { eventId, userId } },
        data: { role },
        include: { user: true },
      })
      return {
        user: toUser(updated.user),
        role: updated.role,
        isCurrentUser: userId === user.id,
      }
    })
  }

  async revoke(eventId: string, userId: string, user: User): Promise<void> {
    const { actor } = await this.access.authorize(
      eventId,
      user,
      'MANAGE_PERMISSIONS',
    )
    await this.prisma.$transaction(async (tx) => {
      const memberships = await this.memberships(tx, eventId)
      assertCanChangeMembership(actor, memberships, {
        eventId,
        userId,
        newRole: null,
      })
      await tx.eventMembership.delete({
        where: { eventId_userId: { eventId, userId } },
      })
    })
  }

  async changeInvitationRole(
    eventId: string,
    invitationId: string,
    role: string,
    user: User,
  ): Promise<EventInvitation> {
    const { actor } = await this.access.authorize(
      eventId,
      user,
      'MANAGE_PERMISSIONS',
    )
    assertRole(role)
    const current = await this.invitationOf(eventId, invitationId)
    assertCanChangeInvitation(actor, {
      currentRole: current.role,
      newRole: role,
    })
    const updated = await this.prisma.eventInvitation.update({
      where: { id: current.id },
      data: { role },
    })
    return toInvitation(updated)
  }

  async cancelInvitation(
    eventId: string,
    invitationId: string,
    user: User,
  ): Promise<void> {
    const { actor } = await this.access.authorize(
      eventId,
      user,
      'MANAGE_PERMISSIONS',
    )
    const current = await this.invitationOf(eventId, invitationId)
    assertCanChangeInvitation(actor, {
      currentRole: current.role,
      newRole: null,
    })
    await this.prisma.eventInvitation.delete({ where: { id: current.id } })
  }

  /** The event's memberships, locked so concurrent changes keep an Owner. */
  private async memberships(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    eventId: string,
  ): Promise<EventMembership[]> {
    await tx.$queryRaw`SELECT 1 FROM "EventMembership" WHERE "eventId" = ${eventId}::uuid FOR UPDATE`
    return tx.eventMembership.findMany({ where: { eventId } })
  }

  private async invitationOf(eventId: string, invitationId: string) {
    const invitation = /^[0-9a-f-]{36}$/i.test(invitationId)
      ? await this.prisma.eventInvitation.findFirst({
          where: { id: invitationId, eventId },
        })
      : null
    if (!invitation) {
      throw new DomainError('NOT_FOUND', { entity: 'invitation' })
    }
    return invitation
  }
}
