import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'
import { EVENT_ROLES, type EventRole } from '../domain/roles.ts'
import { NOTIFICATION_KINDS, type NotificationKind } from '../domain/models.ts'

export class NotificationDto {
  id!: string
  @ApiProperty({ enum: NOTIFICATION_KINDS })
  kind!: NotificationKind
  /** Null once the event was deleted. */
  @ApiProperty({ type: String, nullable: true })
  eventId!: string | null
  /** The event's name when it happened. */
  eventName!: string
  /** Who did it; null when nobody did. */
  @ApiProperty({ type: String, nullable: true })
  actorName!: string | null
  @ApiProperty({ enum: EVENT_ROLES, nullable: true })
  role!: EventRole | null
  createdAt!: string
  read!: boolean
}

export class NotificationListDto {
  @ApiProperty({ type: [NotificationDto] })
  items!: NotificationDto[]
  /** Unread notices, including any beyond the listed ones. */
  unread!: number
}

export class MarkReadDto {
  /** The notice to mark read; every notice when left out. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string
}
