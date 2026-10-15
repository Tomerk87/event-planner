import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength } from 'class-validator'
import { GuestDto } from '../guests/guests.dto.ts'

export class TemplateInputDto {
  /** The length limit and the empty check are applied by src/domain/messages.ts. */
  @IsString()
  @MaxLength(5000)
  body!: string
}

export class MessageTemplateDto {
  eventId!: string
  body!: string
}

export class DefaultTemplateDto {
  body!: string
}

export class MessageValuesDto {
  first_name!: string
  last_name!: string
  event_name!: string
  event_date!: string
  event_time!: string
  rsvp_url!: string
}

export class MessagePreviewDto {
  message!: string
  /** The wa.me link that opens WhatsApp with this message to this guest. */
  launchUrl!: string
}

export class MessageSendDto {
  id!: string
  eventId!: string
  guestId!: string
  sentAt!: string
  message!: string
}

export class SendResultDto extends MessagePreviewDto {
  @ApiProperty({ type: GuestDto })
  guest!: GuestDto
  @ApiProperty({ type: MessageSendDto })
  send!: MessageSendDto
}

export class SentMessageDto extends MessageSendDto {
  guestName!: string
  phone!: string
  /** False once the guest has been deleted. */
  guestActive!: boolean
}
