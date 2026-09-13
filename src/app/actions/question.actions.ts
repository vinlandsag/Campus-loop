'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  getEventUserRole,
  canManageQuestions,
  canViewRegistrationAnswers,
} from '@/lib/auth/teams'
import type { RegistrationQuestion } from '@/types'

/**
 * Fetch registration questions configured for an event.
 */
export async function getEventQuestions(
  eventId: string
): Promise<{ success: boolean; questions: RegistrationQuestion[]; error?: string }> {
  const supabase = await createClient()

  try {
    // Defense-in-depth: Ensure draft/unpublished event questions are restricted to event staff
    const { data: event } = await supabase
      .from('events')
      .select('status')
      .eq('id', eventId)
      .maybeSingle()

    if (event && event.status !== 'published') {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return { success: false, questions: [], error: 'Questions are private for unpublished events.' }
      }

      const role = await getEventUserRole(eventId, user.id)
      if (!role) {
        return { success: false, questions: [], error: 'Unauthorized to view questions for unpublished event.' }
      }
    }

    const { data, error } = await supabase
      .from('event_registration_questions')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.warn('Error loading questions (fallback empty):', error.message)
      return { success: true, questions: [] }
    }

    const questions: RegistrationQuestion[] = (data || []).map((q) => ({
      id: q.id,
      event_id: q.event_id,
      question_text: q.question_text,
      question_type: q.question_type as RegistrationQuestion['question_type'],
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      is_required: Boolean(q.is_required),
      sort_order: q.sort_order ?? 0,
      created_at: q.created_at,
      updated_at: q.updated_at,
    }))

    return { success: true, questions }
  } catch (err) {
    console.error('getEventQuestions exception:', err)
    return { success: true, questions: [] }
  }
}

/**
 * Save or update registration questions for an event.
 */
export async function saveEventQuestions(
  eventId: string,
  questions: Array<Omit<RegistrationQuestion, 'id' | 'event_id'> & { id?: string }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canManageQuestions(role)) {
    return { success: false, error: 'Only event owners and editors can modify registration questions.' }
  }

  try {
    // 1. Delete existing questions that are no longer in the submitted list
    const incomingIds = questions.filter((q) => Boolean(q.id)).map((q) => q.id as string)

    if (incomingIds.length > 0) {
      await supabase
        .from('event_registration_questions')
        .delete()
        .eq('event_id', eventId)
        .not('id', 'in', `(${incomingIds.join(',')})`)
    } else {
      await supabase
        .from('event_registration_questions')
        .delete()
        .eq('event_id', eventId)
    }

    // 2. Upsert each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!
      if (!q.question_text.trim()) continue

      const payload = {
        event_id: eventId,
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        options: q.options || [],
        is_required: Boolean(q.is_required),
        sort_order: i,
        updated_at: new Date().toISOString(),
      }

      if (q.id && !q.id.startsWith('temp-')) {
        await supabase
          .from('event_registration_questions')
          .update(payload as unknown as Record<string, unknown>)
          .eq('id', q.id)
          .eq('event_id', eventId)
      } else {
        await supabase
          .from('event_registration_questions')
          .insert(payload as unknown as Record<string, unknown>)
      }
    }

    revalidatePath(`/dashboard/events/${eventId}/questions`)
    revalidatePath(`/dashboard/events/${eventId}/participants`)
    revalidatePath(`/events`)

    return { success: true }
  } catch (err: unknown) {
    console.error('Failed to save questions:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Save answers submitted during attendee registration.
 */
export async function saveRegistrationAnswers(
  registrationId: string,
  answers: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    const entries = Object.entries(answers).filter(([_, val]) => val !== undefined && val !== null)
    if (entries.length === 0) return { success: true }

    const rows = entries.map(([questionId, val]) => ({
      registration_id: registrationId,
      question_id: questionId,
      answer_text: String(val).trim(),
    }))

    for (const row of rows) {
      const { error } = await supabase
        .from('registration_answers')
        .upsert(row as unknown as Record<string, unknown>, {
          onConflict: 'registration_id,question_id',
        })
      if (error) {
        console.error('Failed to save registration answer:', error)
        return { success: false, error: error.message }
      }
    }

    return { success: true }
  } catch (err: unknown) {
    console.error('saveRegistrationAnswers error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save registration answers',
    }
  }
}

/**
 * Fetch answers for all participants of an event.
 * Returns a map of registration_id -> Record<question_id, answer_text>.
 */
export async function getEventAnswersMap(
  eventId: string
): Promise<Map<string, Record<string, string>>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Map()

  const role = await getEventUserRole(eventId, user.id)
  if (!canViewRegistrationAnswers(role)) return new Map()

  try {
    // 1. Get all registration IDs for this event
    const { data: regs } = await supabase
      .from('registrations')
      .select('id')
      .eq('event_id', eventId)

    if (!regs || regs.length === 0) return new Map()

    const regIds = regs.map((r) => r.id)

    // 2. Fetch answers
    const { data: answers } = await supabase
      .from('registration_answers')
      .select('registration_id, question_id, answer_text')
      .in('registration_id', regIds)

    const map = new Map<string, Record<string, string>>()

    if (answers) {
      for (const a of answers) {
        if (!map.has(a.registration_id)) {
          map.set(a.registration_id, {})
        }
        map.get(a.registration_id)![a.question_id] = a.answer_text
      }
    }

    return map
  } catch (err) {
    console.warn('getEventAnswersMap fallback warning:', err)
    return new Map()
  }
}
