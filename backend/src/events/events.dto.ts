import { ApiProperty } from '@nestjs/swagger'
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator'

/** Shapes only; ranges and rules are applied by src/domain/events.ts. */
export class EventInputDto {
  @IsString()
  @MaxLength(120)
  name!: string

  @IsISO8601()
  startsAt!: string

  @IsString()
  @MaxLength(64)
  timeZone!: string

  @IsInt()
  maxAttendees!: number

  @IsInt()
  defaultAllowedAttendees!: number

  @IsIn(['en', 'he'])
  rsvpLanguage!: 'en' | 'he'

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  location?: string | null

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  rsvpTitle?: string | null

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'A JPEG or PNG data address to set the photo, null to remove it, the current photo address or nothing to keep it.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(400_000)
  coverImage?: string | null
}

export class DuplicateEventDto {
  @IsString()
  @MaxLength(120)
  name!: string

  @IsISO8601()
  startsAt!: string
}

export class EventDto {
  id!: string
  name!: string
  startsAt!: string
  timeZone!: string
  maxAttendees!: number
  defaultAllowedAttendees!: number
  @ApiProperty({ enum: ['en', 'he'] })
  rsvpLanguage!: 'en' | 'he'
  @ApiProperty({ type: String, nullable: true })
  location!: string | null
  @ApiProperty({ type: String, nullable: true })
  rsvpTitle!: string | null
  @ApiProperty({ type: String, nullable: true })
  coverImage!: string | null
  rsvpSlug!: string
}

export class EventAccessInfoDto {
  event!: EventDto
  @ApiProperty({ enum: ['OWNER', 'ADMIN', 'VIEWER'] })
  role!: 'OWNER' | 'ADMIN' | 'VIEWER'
  isPast!: boolean
}

export class EventSummaryDto extends EventAccessInfoDto {
  confirmedAttendees!: number
}
