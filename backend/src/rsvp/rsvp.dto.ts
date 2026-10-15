import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

const RESPONSES = ['APPROVED', 'NOT_SURE', 'DECLINED'] as const

/** Shapes only; the limits are applied by src/domain/rsvpSettings.ts. */
export class CalendarDto {
  @IsBoolean()
  enabled!: boolean

  @IsString()
  @MaxLength(500)
  title!: string

  /** YYYY-MM-DD in the event's time zone. */
  @IsString()
  @MaxLength(10)
  date!: string

  /** HH:mm in the event's time zone. */
  @IsString()
  @MaxLength(5)
  time!: string

  @IsString()
  @MaxLength(500)
  location!: string
}

export class YoutubeDto {
  @IsBoolean()
  enabled!: boolean

  @IsString()
  @MaxLength(500)
  url!: string
}

export class RsvpSettingsInputDto {
  @IsString()
  @MaxLength(2000)
  welcomeMessage!: string

  @IsString()
  @MaxLength(2000)
  approvedMessage!: string

  @IsString()
  @MaxLength(2000)
  declinedMessage!: string

  @IsString()
  @MaxLength(2000)
  notSureMessage!: string

  /**
   * A new picture as a `data:image/...;base64,` address, the current
   * picture's own address to keep it, or null for none.
   */
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1_000_000)
  backgroundImage!: string | null

  @IsInt()
  overlayOpacity!: number

  /** Zoom of the background picture, 100–300 percent. */
  @IsInt()
  imageZoom!: number

  /** The point of the picture kept in view, 0–100 percent from the start. */
  @IsInt()
  imagePositionX!: number

  /** The point of the picture kept in view, 0–100 percent from the top. */
  @IsInt()
  imagePositionY!: number

  @ValidateNested()
  @Type(() => CalendarDto)
  calendar!: CalendarDto

  @ValidateNested()
  @Type(() => YoutubeDto)
  youtube!: YoutubeDto
}

export class RsvpSettingsDto extends RsvpSettingsInputDto {
  eventId!: string
}

export class PublicRsvpViewDto {
  title!: string
  startsAt!: string
  timeZone!: string
  @ApiProperty({ type: String, nullable: true })
  location!: string | null
  @ApiProperty({ enum: ['en', 'he'] })
  language!: 'en' | 'he'
  isClosed!: boolean
  maxSelectableAttendees!: number
  @ApiProperty({ type: RsvpSettingsInputDto })
  settings!: RsvpSettingsInputDto
}

export class PublicRsvpInputDto {
  @IsString()
  @MaxLength(120)
  name!: string

  @IsString()
  @MaxLength(40)
  phone!: string

  @ApiProperty({ enum: RESPONSES })
  @IsIn(RESPONSES)
  status!: (typeof RESPONSES)[number]

  /** Always required; discarded for Declined and Not Sure. */
  @IsInt()
  attendees!: number
}

/** Identical for every phone: it never tells whether the phone is a guest's. */
export class PublicRsvpResultDto {
  @ApiProperty({ enum: RESPONSES })
  status!: (typeof RESPONSES)[number]
  @ApiProperty({ type: Number, nullable: true })
  confirmedAttendees!: number | null
}
