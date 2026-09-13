'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canManageEvent } from '@/lib/auth/teams'
import {
  generateCertificateCode,
  generateCertificateHash,
  formatPublicRecipientName,
} from '@/lib/certificates/verification'
import type {
  ActionResult,
  EventCertificate,
  EventCertificateConfig,
  PublicCertificateVerification,
  CertificateEligibility,
} from '@/types'

/**
 * Fetch the certificate configuration for an event.
 */
export async function getEventCertificateConfig(
  eventId: string
): Promise<ActionResult<EventCertificateConfig | null>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('event_certificate_configs')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) {
    console.error('Failed to get certificate config:', error)
    return { success: false, error: error.message }
  }

  if (!data) {
    return { success: true, data: null }
  }

  const config: EventCertificateConfig = {
    id: data.id,
    event_id: data.event_id,
    is_enabled: data.is_enabled,
    eligibility: data.eligibility as CertificateEligibility,
    title: data.title,
    description: data.description,
    issuer_name: data.issuer_name,
    signatory_title: data.signatory_title,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }

  return { success: true, data: config }
}

/**
 * Save or update certificate configuration for an event (organizer only).
 */
export async function saveEventCertificateConfig(
  eventId: string,
  configData: {
    is_enabled: boolean
    eligibility: CertificateEligibility
    title: string
    description?: string | null
    issuer_name?: string | null
    signatory_title?: string | null
  }
): Promise<ActionResult<EventCertificateConfig>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canManageEvent(role)) {
    return { success: false, error: 'Only event owners and editors can configure certificates.' }
  }

  const payload = {
    event_id: eventId,
    is_enabled: configData.is_enabled,
    eligibility: configData.eligibility,
    title: configData.title.trim() || 'Certificate of Attendance',
    description: configData.description?.trim() || null,
    issuer_name: configData.issuer_name?.trim() || null,
    signatory_title: configData.signatory_title?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('event_certificate_configs')
    .upsert(payload, { onConflict: 'event_id' })
    .select()
    .single()

  if (error || !data) {
    console.error('Failed to save certificate config:', error)
    return { success: false, error: error?.message || 'Failed to save configuration.' }
  }

  revalidatePath(`/dashboard/events/${eventId}/certificates`)
  revalidatePath(`/events`)

  return {
    success: true,
    data: {
      id: data.id,
      event_id: data.event_id,
      is_enabled: data.is_enabled,
      eligibility: data.eligibility as CertificateEligibility,
      title: data.title,
      description: data.description,
      issuer_name: data.issuer_name,
      signatory_title: data.signatory_title,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  }
}

/**
 * Claim or retrieve an issued certificate for the current authenticated student.
 * Validates eligibility (e.g. checked-in attendance by default).
 */
export async function issueOrGetCertificate(
  eventId: string
): Promise<ActionResult<EventCertificate>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to claim a certificate.' }
  }

  // 1. Check if certificate is already issued
  const { data: existingCert } = await supabase
    .from('event_certificates')
    .select('*, events(id, title, event_date, slug)')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingCert) {
    const cert: EventCertificate = {
      id: existingCert.id,
      event_id: existingCert.event_id,
      user_id: existingCert.user_id,
      certificate_code: existingCert.certificate_code,
      verification_hash: existingCert.verification_hash,
      recipient_name: existingCert.recipient_name,
      status: existingCert.status as 'valid' | 'revoked',
      issued_at: existingCert.issued_at,
      revoked_at: existingCert.revoked_at,
      revocation_reason: existingCert.revocation_reason,
      event: existingCert.events as unknown as EventCertificate['event'],
    }
    return { success: true, data: cert }
  }

  // 2. Fetch event certificate config
  const { data: config } = await supabase
    .from('event_certificate_configs')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  const isEnabled = config ? config.is_enabled : true
  const eligibility = (config?.eligibility || 'checked_in') as CertificateEligibility

  if (!isEnabled) {
    return { success: false, error: 'Certificates are not enabled for this event.' }
  }

  // 3. Verify attendee registration and eligibility
  const { data: registration } = await supabase
    .from('registrations')
    .select('id, status, checked_in_at')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!registration || registration.status === 'cancelled') {
    return { success: false, error: 'You do not have an active registration for this event.' }
  }

  if (eligibility === 'checked_in' && registration.status !== 'checked_in' && !registration.checked_in_at) {
    return {
      success: false,
      error: 'Certificate requires verified attendance. Your ticket was not checked in during the event.',
    }
  }

  if (eligibility === 'manual') {
    return {
      success: false,
      error: 'Certificates for this event are awarded manually by the organizer.',
    }
  }

  // 4. Fetch event and student profile info
  const [{ data: event }, { data: profile }] = await Promise.all([
    supabase.from('events').select('id, title, event_date, slug').eq('id', eventId).single(),
    supabase.from('profiles').select('id, full_name').eq('id', user.id).single(),
  ])

  if (!event) {
    return { success: false, error: 'Event not found.' }
  }

  const recipientName = profile?.full_name?.trim() || user.user_metadata?.['full_name'] || 'Verified Attendee'
  const certificateCode = generateCertificateCode(event.slug)
  const issuedAt = new Date().toISOString()
  const verificationHash = generateCertificateHash({
    certificateCode,
    eventId,
    userId: user.id,
    issuedAt,
  })

  // 5. Insert certificate record
  const { data: newCert, error: insertErr } = await supabase
    .from('event_certificates')
    .insert({
      event_id: eventId,
      user_id: user.id,
      certificate_code: certificateCode,
      verification_hash: verificationHash,
      recipient_name: recipientName,
      status: 'valid',
      issued_at: issuedAt,
    })
    .select('*, events(id, title, event_date, slug)')
    .single()

  if (insertErr || !newCert) {
    console.error('Failed to issue certificate:', insertErr)
    return { success: false, error: insertErr?.message || 'Failed to issue certificate.' }
  }

  revalidatePath('/my-events')

  return {
    success: true,
    data: {
      id: newCert.id,
      event_id: newCert.event_id,
      user_id: newCert.user_id,
      certificate_code: newCert.certificate_code,
      verification_hash: newCert.verification_hash,
      recipient_name: newCert.recipient_name,
      status: newCert.status as 'valid' | 'revoked',
      issued_at: newCert.issued_at,
      event: newCert.events as unknown as EventCertificate['event'],
    },
  }
}

/**
 * Public minimal certificate verification query.
 * Reveals minimal information to preserve student privacy while verifying authenticity.
 */
export async function verifyCertificatePublic(
  certificateCode: string
): Promise<ActionResult<PublicCertificateVerification>> {
  const supabase = await createClient()

  const cleanCode = certificateCode.trim().toUpperCase()

  const { data, error } = await supabase.rpc('verify_certificate', {
    p_certificate_code: cleanCode,
  })

  if (error || !data || data.length === 0) {
    return { success: false, error: 'Certificate code not found or invalid.' }
  }

  const row = data[0]

  return {
    success: true,
    data: {
      is_valid: Boolean(row.is_valid),
      certificate_code: row.certificate_code,
      recipient_name: formatPublicRecipientName(row.recipient_name),
      event_title: row.event_title,
      event_date: row.event_date,
      issuer_name: row.issuer_name,
      certificate_title: row.certificate_title,
      status: row.status,
      issued_at: row.issued_at,
    },
  }
}

/**
 * List all issued certificates for an event (organizers/editors only).
 */
export async function getEventCertificatesList(
  eventId: string
): Promise<ActionResult<EventCertificate[]>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canManageEvent(role)) {
    return { success: false, error: 'Forbidden' }
  }

  const { data, error } = await supabase
    .from('event_certificates')
    .select('*, events(id, title, event_date, slug)')
    .eq('event_id', eventId)
    .order('issued_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const certs: EventCertificate[] = (data || []).map((c) => ({
    id: c.id,
    event_id: c.event_id,
    user_id: c.user_id,
    certificate_code: c.certificate_code,
    verification_hash: c.verification_hash,
    recipient_name: c.recipient_name,
    status: c.status as 'valid' | 'revoked',
    issued_at: c.issued_at,
    revoked_at: c.revoked_at,
    revocation_reason: c.revocation_reason,
    event: c.events as unknown as EventCertificate['event'],
  }))

  return { success: true, data: certs }
}
