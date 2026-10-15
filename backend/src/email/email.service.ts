import { Inject, Injectable, Logger } from '@nestjs/common'
import { AttemptLimiter } from '../common/attempt-limiter.ts'
import { APP_CONFIG, type AppConfig } from '../config.ts'
import { MAILER, type EmailMessage, type Mailer } from './mailer.ts'

const HOUR_MS = 60 * 60 * 1000

/**
 * Sends the application's emails (D88). Every kind of email is limited per
 * address, so nobody can flood an inbox through the application, and a
 * failure to deliver is logged rather than failing the request that caused
 * it: the person can ask again.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email')
  private readonly limiter: AttemptLimiter

  constructor(
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.limiter = new AttemptLimiter(config.email.perAddressPerHour, HOUR_MS)
  }

  /** Whether emails really leave the server; off by default (D88). */
  get enabled(): boolean {
    return this.config.email.mode === 'smtp'
  }

  /** Whether another email of this kind may go to the address this hour. */
  allows(kind: string, address: string): boolean {
    return this.limiter.allows(`${kind}:${address}`)
  }

  /** An address in the application, for a link in an email. */
  link(path: string, query: Record<string, string> = {}): string {
    const url = new URL(path, `${this.config.publicAppUrl}/`)
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value)
    }
    return url.toString()
  }

  /**
   * Sends the email and counts it against the address's limit. Returns
   * whether it was handed to the provider.
   */
  async send(message: EmailMessage): Promise<boolean> {
    this.limiter.record(`${message.kind}:${message.to}`)
    try {
      await this.mailer.send(message)
      return true
    } catch (error) {
      // The provider's message can quote the recipient; only its codes are
      // logged.
      const { code, responseCode } = (error ?? {}) as {
        code?: string
        responseCode?: number
      }
      this.logger.error(
        `Could not send ${message.kind}: ${code ?? 'error'} ${responseCode ?? ''}`.trim(),
      )
      return false
    }
  }
}
