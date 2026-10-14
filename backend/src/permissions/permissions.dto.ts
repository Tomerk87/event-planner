import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsString, MaxLength } from 'class-validator'
import { UserDto } from '../auth/auth.dto.ts'

const ROLES = ['OWNER', 'ADMIN', 'VIEWER'] as const
type Role = (typeof ROLES)[number]

export class InviteDto {
  @IsString()
  @MaxLength(254)
  email!: string

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role!: Role
}

export class RoleDto {
  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role!: Role
}

export class MemberDto {
  user!: UserDto
  @ApiProperty({ enum: ROLES })
  role!: Role
  isCurrentUser!: boolean
}

export class InvitationDto {
  id!: string
  eventId!: string
  email!: string
  @ApiProperty({ enum: ROLES })
  role!: Role
}

export class EventAccessListDto {
  members!: MemberDto[]
  invitations!: InvitationDto[]
}

export class InviteResultDto {
  @ApiProperty({ enum: ['member', 'invitation'] })
  kind!: 'member' | 'invitation'
  @ApiProperty({ required: false })
  member?: MemberDto
  @ApiProperty({ required: false })
  invitation?: InvitationDto
}
