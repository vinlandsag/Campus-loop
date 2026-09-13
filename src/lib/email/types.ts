import type { EmailDeliveryStatus } from '@/types'

export interface EmailAttachment {
  filename: string
  content: string | Buffer
  contentType: string
}

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
  from?: string
  replyTo?: string
  headers?: Record<string, string>
  attachments?: EmailAttachment[]
}

export interface EmailSendResult {
  success: boolean
  status: EmailDeliveryStatus
  provider: string
  messageId?: string
  error?: string
  sentAt?: string
}

export interface IEmailProvider {
  readonly name: string
  isConfigured(): boolean
  sendEmail(message: EmailMessage): Promise<EmailSendResult>
}
