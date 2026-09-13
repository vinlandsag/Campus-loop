'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { EventWebhookIntegration } from '@/types'

function validateWebhookUrl(url: string, platform: string): boolean {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'https:') return false

    if (platform === 'discord' && !parsed.hostname.endsWith('discord.com')) {
      return false
    }
    if (platform === 'slack' && !parsed.hostname.endsWith('slack.com')) {
      return false
    }

    return true
  } catch {
    return false
  }
}

export async function getEventIntegrations(
  eventId: string
): Promise<{ success: boolean; data?: EventWebhookIntegration[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('event_webhook_integrations')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching event integrations:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as EventWebhookIntegration[] }
  } catch (err) {
    console.error('getEventIntegrations failure:', err)
    return { success: false, error: 'Failed to retrieve integrations' }
  }
}

export async function saveEventIntegration(
  eventId: string,
  input: {
    platform: 'discord' | 'slack' | 'generic'
    webhook_url: string
    notify_on_announcement?: boolean
    notify_on_reschedule?: boolean
  }
): Promise<{ success: boolean; data?: EventWebhookIntegration; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    if (!input.webhook_url || !validateWebhookUrl(input.webhook_url, input.platform)) {
      return {
        success: false,
        error: `Invalid ${input.platform.toUpperCase()} webhook URL. Must be a valid HTTPS webhook URL.`,
      }
    }

    const { data, error } = await supabase
      .from('event_webhook_integrations')
      .insert({
        event_id: eventId,
        platform: input.platform,
        webhook_url: input.webhook_url.trim(),
        is_enabled: true,
        notify_on_announcement: input.notify_on_announcement !== false,
        notify_on_reschedule: input.notify_on_reschedule !== false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving webhook integration:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/dashboard/events/${eventId}/integrations`)
    return { success: true, data: data as EventWebhookIntegration }
  } catch (err) {
    console.error('saveEventIntegration failure:', err)
    return { success: false, error: 'Failed to save integration' }
  }
}

export async function deleteEventIntegration(
  eventId: string,
  integrationId: string
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
      .from('event_webhook_integrations')
      .delete()
      .eq('id', integrationId)
      .eq('event_id', eventId)

    if (error) {
      console.error('Error deleting webhook integration:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/dashboard/events/${eventId}/integrations`)
    return { success: true }
  } catch (err) {
    console.error('deleteEventIntegration failure:', err)
    return { success: false, error: 'Failed to delete integration' }
  }
}

export async function testWebhookIntegration(
  integrationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: wh, error } = await supabase
      .from('event_webhook_integrations')
      .select('*, events(title, slug)')
      .eq('id', integrationId)
      .single()

    if (error || !wh) {
      return { success: false, error: 'Integration not found' }
    }

    const eventTitle = (wh.events as { title?: string; slug?: string } | null)?.title || 'CampusLoop Event'
    const testUrl = wh.webhook_url.trim()

    let testPayload: Record<string, unknown>
    if (wh.platform === 'discord') {
      testPayload = {
        username: 'CampusLoop Integration Test',
        content: `🔔 **Test Notification** for **${eventTitle}**! Webhook integration connected successfully.`,
      }
    } else if (wh.platform === 'slack') {
      testPayload = {
        text: `🔔 Test Notification: CampusLoop integration connected for ${eventTitle}!`,
      }
    } else {
      testPayload = {
        type: 'test_ping',
        eventTitle,
        message: 'CampusLoop webhook integration test ping successful.',
        timestamp: new Date().toISOString(),
      }
    }

    const res = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return { success: false, error: `Webhook rejected test ping (HTTP ${res.status})` }
    }

    return { success: true }
  } catch (err) {
    console.error('testWebhookIntegration failure:', err)
    return { success: false, error: 'Network timeout or failed to reach webhook destination' }
  }
}
