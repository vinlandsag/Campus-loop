'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { EventTranslation } from '@/types'

export async function getEventTranslations(
  eventId: string
): Promise<{ success: boolean; data?: EventTranslation[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('event_translations')
      .select('*')
      .eq('event_id', eventId)
      .order('language_name', { ascending: true })

    if (error) {
      console.error('Error fetching event translations:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as EventTranslation[] }
  } catch (err) {
    console.error('getEventTranslations failure:', err)
    return { success: false, error: 'Failed to retrieve translations' }
  }
}

export async function saveEventTranslation(
  eventId: string,
  input: {
    language_code: string
    language_name: string
    title: string
    description: string
    what_to_bring?: string | null
    eligibility?: string | null
    change_notice?: string | null
    is_machine_translated: boolean
  }
): Promise<{ success: boolean; data?: EventTranslation; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    if (!input.language_code || !input.language_name || !input.title || !input.description) {
      return { success: false, error: 'Language, Title, and Description are required' }
    }

    const payload = {
      event_id: eventId,
      language_code: input.language_code.trim().toLowerCase(),
      language_name: input.language_name.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      details: {
        what_to_bring: input.what_to_bring?.trim() || null,
        eligibility: input.eligibility?.trim() || null,
        change_notice: input.change_notice?.trim() || null,
      },
      is_machine_translated: !!input.is_machine_translated,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('event_translations')
      .upsert(payload, { onConflict: 'event_id,language_code' })
      .select()
      .single()

    if (error) {
      console.error('Error saving event translation:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/events/[slug]`, 'page')
    revalidatePath(`/dashboard/events/${eventId}/translations`)
    return { success: true, data: data as EventTranslation }
  } catch (err) {
    console.error('saveEventTranslation failure:', err)
    return { success: false, error: 'Failed to save translation' }
  }
}

export async function deleteEventTranslation(
  eventId: string,
  translationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('event_translations')
      .delete()
      .eq('id', translationId)
      .eq('event_id', eventId)

    if (error) {
      console.error('Error deleting translation:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/events/[slug]`, 'page')
    revalidatePath(`/dashboard/events/${eventId}/translations`)
    return { success: true }
  } catch (err) {
    console.error('deleteEventTranslation failure:', err)
    return { success: false, error: 'Failed to delete translation' }
  }
}
