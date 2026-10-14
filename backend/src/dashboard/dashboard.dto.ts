import { ApiProperty } from '@nestjs/swagger'

export class DashboardMetricsDto {
  totalGuests!: number
  invitationsSent!: number
  invitationsNotSent!: number
  awaitingResponse!: number
  rsvpApproved!: number
  rsvpNotSure!: number
  rsvpDeclined!: number
  confirmedAttendees!: number
  seatingCapacity!: number
  unassignedConfirmedAttendees!: number
}

export class TableConflictDto {
  tableId!: string
  tableNumber!: number
  /** Attendees beyond the table's capacity. */
  over!: number
}

export class DashboardWarningsDto {
  attendeesOverMaximum!: number
  seatingVersusMaximum!: number
  seatsShort!: number
  @ApiProperty({ type: [TableConflictDto] })
  tablesOverCapacity!: TableConflictDto[]
  attendeesAwaitingTable!: number
}

/** One recent event: a guest's latest RSVP, or a recorded send. */
export class ActivityItemDto {
  @ApiProperty({ enum: ['RSVP', 'INVITATION_SENT'] })
  kind!: 'RSVP' | 'INVITATION_SENT'
  guestId!: string
  guestName!: string
  at!: string
  /** RSVP entries only. */
  @ApiProperty({ enum: ['APPROVED', 'NOT_SURE', 'DECLINED'], required: false })
  status?: 'APPROVED' | 'NOT_SURE' | 'DECLINED'
  /** RSVP entries only. */
  @ApiProperty({ type: Number, nullable: true, required: false })
  confirmedAttendees?: number | null
}

export class DashboardDto {
  @ApiProperty({ type: DashboardMetricsDto })
  metrics!: DashboardMetricsDto
  @ApiProperty({ type: DashboardWarningsDto })
  warnings!: DashboardWarningsDto
  @ApiProperty({ type: [ActivityItemDto] })
  recentActivity!: ActivityItemDto[]
}
