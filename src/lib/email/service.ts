import type { IEmailProvider, EmailMessage, EmailSendResult } from './types'

/**
 * Null provider used when no email credentials (e.g. RESEND_API_KEY, SMTP_HOST) are configured.
 * Guarantees that CampusLoop never falsely reports an email was sent.
 */
export class NullEmailProvider implements IEmailProvider {
  readonly name = 'none'

  isConfigured(): boolean {
    return false
  }

  async sendEmail(_message: EmailMessage): Promise<EmailSendResult> {
    return {
      success: false,
      status: 'skipped_no_provider',
      provider: this.name,
      error: 'No production email provider configured. In-app notification retained; email skipped.',
    }
  }
}

/**
 * Production-ready mock or webhook/REST email provider.
 * Activated when RESEND_API_KEY or EMAIL_PROVIDER_API_KEY is defined in the environment.
 */
export class RestEmailProvider implements IEmailProvider {
  readonly name: string
  private apiKey: string | undefined
  private defaultFrom: string

  constructor(name = 'resend', apiKey?: string, defaultFrom = 'CampusLoop <notifications@campusloop.internal>') {
    this.name = name
    this.apiKey = apiKey || process.env['RESEND_API_KEY'] || process.env['EMAIL_PROVIDER_API_KEY']
    this.defaultFrom = process.env['EMAIL_FROM_ADDRESS'] || defaultFrom
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0)
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'skipped_no_provider',
        provider: this.name,
        error: `Production email provider "${this.name}" is not configured. Missing API key.`,
      }
    }

    try {
      // In testing or staging environments with mock key, simulate successful remote dispatch
      if (process.env.NODE_ENV === 'test' || this.apiKey?.startsWith('mock_')) {
        return {
          success: true,
          status: 'sent',
          provider: this.name,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          sentAt: new Date().toISOString(),
        }
      }

      // Live dispatch via provider endpoint if available
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from || this.defaultFrom,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          headers: message.headers,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          status: 'failed',
          provider: this.name,
          error: `Provider HTTP error ${response.status}: ${errorText}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        status: 'sent',
        provider: this.name,
        messageId: data.id || `msg_${Date.now()}`,
        sentAt: new Date().toISOString(),
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        status: 'failed',
        provider: this.name,
        error: `Failed to deliver email: ${errMsg}`,
      }
    }
  }
}

/**
 * Provider-agnostic email delivery service manager.
 */
export class EmailDeliveryService {
  private provider: IEmailProvider

  constructor(provider?: IEmailProvider) {
    if (provider) {
      this.provider = provider
    } else {
      const resendKey = process.env['RESEND_API_KEY'] || process.env['EMAIL_PROVIDER_API_KEY']
      this.provider = resendKey ? new RestEmailProvider('resend', resendKey) : new NullEmailProvider()
    }
  }

  setProvider(provider: IEmailProvider) {
    this.provider = provider
  }

  getProvider(): IEmailProvider {
    return this.provider
  }

  isConfigured(): boolean {
    return this.provider.isConfigured()
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!message.to || !message.to.includes('@')) {
      return {
        success: false,
        status: 'failed',
        provider: this.provider.name,
        error: 'Invalid recipient email address.',
      }
    }

    return await this.provider.sendEmail(message)
  }
}

export const emailService = new EmailDeliveryService()
