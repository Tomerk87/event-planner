import { Logger } from '@nestjs/common'
import nodemailer, { type Transporter } from 'nodemailer'
import type { EmailConfig } from '../config.ts'

/** A picture inside an email, shown where the HTML says `cid:<cid>`. */
export interface EmailImage {
  cid: string
  filename: string
  /** The PNG, in base64. */
  png: string
}

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
  images?: EmailImage[]
  /** What the email is for, as logged; never the address or a link. */
  kind: string
}

/** Delivers an email; the application never talks to a provider directly. */
export interface Mailer {
  send(message: EmailMessage): Promise<void>
}

export const MAILER = Symbol('MAILER')

/**
 * Email off (D88): nothing leaves the server. The log names the kind of
 * email only, since an address or a link in a log would be personal data or
 * a usable secret.
 */
export class NullMailer implements Mailer {
  private readonly logger = new Logger('Email')

  send(message: EmailMessage): Promise<void> {
    this.logger.log(`Email is off; not sent: ${message.kind}`)
    return Promise.resolve()
  }
}

/** Any SMTP provider: Amazon SES in production, Mailpit in development. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter

  constructor(private readonly config: EmailConfig) {
    const smtp = config.smtp!
    this.transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth:
        smtp.user && smtp.password
          ? { user: smtp.user, pass: smtp.password }
          : undefined,
    })
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: (message.images ?? []).map((image) => ({
        filename: image.filename,
        content: Buffer.from(image.png, 'base64'),
        contentType: 'image/png',
        cid: image.cid,
        contentDisposition: 'inline' as const,
      })),
    })
  }
}

export function createMailer(config: EmailConfig): Mailer {
  return config.mode === 'smtp' ? new SmtpMailer(config) : new NullMailer()
}
