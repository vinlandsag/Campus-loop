import crypto from 'crypto'
import QRCode from 'qrcode'
import type { TicketData, RegistrationStatus, AttendanceVisibility } from '@/types'

const FORBIDDEN_PRODUCTION_SECRETS = new Set([
  'campusloop-fallback-secret-2026',
  'fallback-secret',
  'default-secret',
  'secret',
])

/**
 * Retrieve the ticket signing secret.
 * In production, fails closed if no secret is configured or if a predictable secret is used.
 */
export function getTicketSecret(): string {
  const secret =
    process.env.TICKET_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET

  if (!secret || secret.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Ticket signing secret is missing. Production requires TICKET_SIGNING_SECRET to be configured.'
      )
    }
    return 'campusloop-dev-only-secret-not-for-production'
  }

  if (process.env.NODE_ENV === 'production' && FORBIDDEN_PRODUCTION_SECRETS.has(secret)) {
    throw new Error('Predictable fallback secret cannot be used in production.')
  }

  return secret
}

/**
 * Generate a secure, tamper-proof ticket code.
 * Format: CL-[SLUG_PREFIX]-[REG_ID_CHUNK]-[HMAC_SIGNATURE_8]
 * Example: CL-HACK26-9B1D4F2A-A8F0C12D
 */
export function generateTicketCode(
  eventId: string,
  eventSlug: string,
  userId: string,
  registrationId: string
): string {
  const secret = getTicketSecret()

  // Clean event slug prefix (up to 6 uppercase alphanumeric chars)
  const cleanSlug = eventSlug
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase() || 'EVENT'

  // Clean regId chunk (first 8 hex/alphanumeric chars)
  const regChunk = registrationId.replace(/-/g, '').slice(0, 8).toUpperCase()

  // Generate 8-character HMAC signature of eventId + userId + registrationId
  const payload = `${eventId}:${userId}:${registrationId}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()

  return `CL-${cleanSlug}-${regChunk}-${signature}`
}

/**
 * Validate the format and signature of a ticket code.
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
export function verifyTicketCodeSignature(
  ticketCode: string,
  eventId: string,
  userId: string,
  registrationId: string
): boolean {
  try {
    const expectedCode = generateTicketCode(eventId, 'ANY', userId, registrationId)
    const expectedSignature = expectedCode.split('-')[3]
    const parts = ticketCode.trim().toUpperCase().split('-')

    if (parts.length < 4 || parts[0] !== 'CL') {
      return false
    }

    const providedSignature = parts[3]
    if (!providedSignature || !expectedSignature) {
      return false
    }

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8')
    const providedBuffer = Buffer.from(providedSignature, 'utf-8')

    if (expectedBuffer.length !== providedBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  } catch {
    // Fail closed if signing secret is missing or error occurs
    return false
  }
}

/**
 * Generate SVG string for QR code rendering.
 */
export async function generateTicketQRCodeSvg(ticketCode: string): Promise<string> {
  try {
    const svg = await QRCode.toString(ticketCode, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      width: 200,
    })
    return svg
  } catch (err) {
    console.error('Failed to generate QR Code SVG:', err)
    return ''
  }
}

/**
 * Generate Data URL (PNG) for QR code downloading or image tags.
 */
export async function generateTicketQRCodeDataUrl(ticketCode: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(ticketCode, {
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      width: 250,
    })
    return dataUrl
  } catch (err) {
    console.error('Failed to generate QR Code Data URL:', err)
    return ''
  }
}

/**
 * Assemble complete TicketData object with QR Code.
 */
export async function buildTicketData(params: {
  eventId: string
  eventSlug: string
  eventTitle: string
  eventStartsAt: string
  eventEndsAt?: string
  eventLocation: string
  campusName?: string | null
  studentId: string
  attendeeName: string
  registrationId: string
  status: RegistrationStatus
  checkedInAt?: string | null
  existingTicketCode?: string | null
  attendanceVisibility?: AttendanceVisibility
}): Promise<TicketData> {
  const ticketCode =
    params.existingTicketCode ||
    generateTicketCode(params.eventId, params.eventSlug, params.studentId, params.registrationId)

  const [qrSvg, qrDataUrl] = await Promise.all([
    generateTicketQRCodeSvg(ticketCode),
    generateTicketQRCodeDataUrl(ticketCode),
  ])

  return {
    ticketCode,
    eventId: params.eventId,
    eventSlug: params.eventSlug,
    eventTitle: params.eventTitle,
    eventStartsAt: params.eventStartsAt,
    eventEndsAt: params.eventEndsAt,
    eventLocation: params.eventLocation,
    campusName: params.campusName,
    studentId: params.studentId,
    attendeeName: params.attendeeName,
    registrationId: params.registrationId,
    status: params.status,
    checkedInAt: params.checkedInAt,
    attendanceVisibility: params.attendanceVisibility,
    qrSvg,
    qrDataUrl,
  }
}
