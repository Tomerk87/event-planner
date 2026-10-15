import { ApiProperty } from '@nestjs/swagger'

/** What the server offers, for the frontend to show or hide (D88). */
export class FeaturesDto {
  /** Whether emails are really sent. */
  email!: boolean
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
