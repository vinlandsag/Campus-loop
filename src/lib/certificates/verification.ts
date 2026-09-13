import crypto from 'node:crypto'

const CERTIFICATE_SECRET = process.env.CERTIFICATE_SIGNING_SECRET || 'campusloop-default-cert-signing-secret-2026'

/**
 * Generate a clean, unique certificate verification code.
 * Format: CL-CERT-[SLUG_SHORT]-[8_CHAR_HEX]
 * e.g., CL-CERT-HACK-F8A2B9C1
 */
export function generateCertificateCode(eventSlug: string = 'CAMPUS'): string {
  const cleanSlug = (eventSlug || 'CAMPUS')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'EVNT'

  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `CL-CERT-${cleanSlug}-${randomHex}`
}

/**
 * Generate a tamper-resistant HMAC-SHA256 signature for a certificate.
 */
export function generateCertificateHash(params: {
  certificateCode: string
  eventId: string
  userId: string
  issuedAt: string
}): string {
  const payload = `${params.certificateCode}:${params.eventId}:${params.userId}:${params.issuedAt}`
  return crypto.createHmac('sha256', CERTIFICATE_SECRET).update(payload).digest('hex')
}

/**
 * Verify that a certificate hash matches the tamper-resistant signature.
 */
export function verifyCertificateHash(
  params: {
    certificateCode: string
    eventId: string
    userId: string
    issuedAt: string
  },
  expectedHash: string
): boolean {
  const computedHash = generateCertificateHash(params)
  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(expectedHash))
  } catch {
    return computedHash === expectedHash
  }
}

/**
 * Privacy-preserving name formatter for public verification pages.
 * Displays minimal identifying information (e.g. "Milan P." or "M. P.")
 */
export function formatPublicRecipientName(fullName?: string | null): string {
  if (!fullName || !fullName.trim()) return 'Verified Campus Student'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return 'Verified Campus Student'
  if (parts.length === 1) return parts[0]

  const firstName = parts[0]
  const lastInitial = parts[parts.length - 1]?.charAt(0).toUpperCase() || ''
  return `${firstName} ${lastInitial}.`
}
