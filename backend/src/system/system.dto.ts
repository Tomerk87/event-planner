import { ApiProperty } from '@nestjs/swagger'

/** An event's Maximum Attendees: the lowest, the highest, a new event's. */
export class EventMaxAttendeesDto {
  min!: number
  max!: number
  default!: number
}

/** People one invitation may confirm: the highest, a new event's. */
export class GuestMaxAttendeesDto {
  max!: number
  default!: number
}

/** The product's adjustable limits, as the server's settings set them (D110). */
export class LimitsDto {
  /** Chairs at one table (TABLE_MAX_SEATS). */
  tableMaxSeats!: number
  eventMaxAttendees!: EventMaxAttendeesDto
  guestMaxAttendees!: GuestMaxAttendeesDto
  /** Rows in one guest import (IMPORT_MAX_ROWS). */
  importMaxRows!: number
  /** Size of an imported guest file in megabytes (IMPORT_MAX_FILE_MB). */
  importMaxFileMb!: number
  /** Size of a chosen picture in megabytes (IMAGE_MAX_FILE_MB). */
  imageMaxFileMb!: number
}

/** What the server offers, for the frontend to show or hide (D88). */
export class FeaturesDto {
  /** Whether emails are really sent. */
  email!: boolean
  /** The limits the server applies; the screens apply the same (D110). */
  limits!: LimitsDto
}

/** The email configuration, without any secret (D91). */
export class EmailStatusDto {
  @ApiProperty({ enum: ['off', 'smtp'] })
  mode!: 'off' | 'smtp'
  @ApiProperty({ type: String, nullable: true })
  host!: string | null
  @ApiProperty({ type: Number, nullable: true })
  port!: number | null
  /** The sender; empty while email is off. */
  from!: string
  /** Whether the server signs in to the provider; never the user or password. */
  authenticated!: boolean
}

export class TestEmailResultDto {
  /** Whether the provider accepted the email; false while email is off. */
  sent!: boolean
}

/** This server's version (D107). */
export class VersionDto {
  /** MAJOR.MINOR, such as "1.4". */
  version!: string
  /** The commit the server was built from; null in development. */
  @ApiProperty({ type: String, nullable: true })
  commit!: string | null
}
