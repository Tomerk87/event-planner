import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

const STATUSES = ['NO_RESPONSE', 'APPROVED', 'NOT_SURE', 'DECLINED'] as const

/** Shapes only; the guest rules are applied by src/domain/guests.ts. */
export class GuestInputDto {
  @IsString()
  @MaxLength(80)
  firstName!: string

  @IsString()
  @MaxLength(80)
  lastName!: string

  @IsString()
  @MaxLength(40)
  phone!: string

  @IsInt()
  allowedAttendees!: number

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  group?: string | null
}

export class ConvertUnknownDto {
  @IsString()
  @MaxLength(80)
  firstName!: string

  @IsString()
  @MaxLength(80)
  lastName!: string

  @IsInt()
  allowedAttendees!: number

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  group?: string | null
}

export class MergeUnknownDto {
  @IsUUID()
  guestId!: string
}

export class GuestRsvpDto {
  @ApiProperty({ enum: STATUSES })
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number]

  @ApiProperty({ type: Number, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  attendees!: number | null
}

export class AssignTableDto {
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  tableId!: string | null
}

export class GuestIdsDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  guestIds!: string[]
}

export class SetGroupDto extends GuestIdsDto {
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  group!: string | null
}

export class ImportGuestsDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => GuestInputDto)
  guests!: GuestInputDto[]
}

export class ExportLabelsDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  @IsObject()
  headings!: Record<string, string>

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  @IsObject()
  statuses!: Record<string, string>
}

export class ExportGuestsDto {
  @ApiProperty({ enum: ['csv', 'xlsx'] })
  @IsIn(['csv', 'xlsx'])
  format!: 'csv' | 'xlsx'

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  guestIds?: string[]

  @ValidateNested()
  @Type(() => ExportLabelsDto)
  labels!: ExportLabelsDto

  @IsString()
  @MaxLength(31)
  sheetName!: string

  @IsBoolean()
  rightToLeft!: boolean
}

export class GuestDto {
  id!: string
  eventId!: string
  firstName!: string
  lastName!: string
  @ApiProperty({ type: String, nullable: true })
  invitationName!: string | null
  phone!: string
  normalizedPhone!: string
  allowedAttendees!: number
  @ApiProperty({ type: Number, nullable: true })
  confirmedAttendees!: number | null
  @ApiProperty({ enum: STATUSES })
  rsvpStatus!: (typeof STATUSES)[number]
  invitationSentCount!: number
  @ApiProperty({ type: String, nullable: true })
  lastInvitationSentAt!: string | null
  @ApiProperty({ type: String, nullable: true })
  lastRsvpResponseAt!: string | null
  @ApiProperty({ type: String, nullable: true })
  tableId!: string | null
  @ApiProperty({ type: String, nullable: true })
  group!: string | null
  deleted!: boolean
}

export class GuestPageDto {
  items!: GuestDto[]
  page!: number
  pageCount!: number
  total!: number
  from!: number
  to!: number
}

export class ImportOutcomeDto {
  created!: number
  restored!: number
}

export class SpreadsheetRowsDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'string' } },
  })
  rows!: string[][]
}

export class UnknownRsvpDto {
  id!: string
  eventId!: string
  name!: string
  phone!: string
  normalizedPhone!: string
  @ApiProperty({ enum: ['APPROVED', 'NOT_SURE', 'DECLINED'] })
  rsvpStatus!: 'APPROVED' | 'NOT_SURE' | 'DECLINED'
  @ApiProperty({ type: Number, nullable: true })
  confirmedAttendees!: number | null
  submittedAt!: string
  @ApiProperty({ type: String, nullable: true })
  rejectedAt!: string | null
}
