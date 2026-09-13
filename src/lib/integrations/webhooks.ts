/**
 * Safe Webhook Dispatcher for Discord and Slack event integrations.
 * Ensures zero private attendee data leakage and non-blocking failure tolerance.
 */

import { createClient } from '@/lib/supabase/server'

interface AnnouncementPayload {
  eventId: string
  eventSlug: string
  eventTitle: string
  category: string
  message: string
  isPinned?: boolean
}

function getCategoryColor(category: string): number {
  switch (category) {
    case 'emergency':
      return 0xef4444 // Red
    case 'venue_change':
      return 0xf59e0b // Amber
    case 'schedule':
      return 0x3b82f6 // Blue
    case 'food':
      return 0x10b981 // Emerald
    default:
      return 0x6366f1 // Indigo
  }
}

export async function dispatchAnnouncementWebhooks(payload: AnnouncementPayload) {
  try {
    const supabase = await createClient()

    // Fetch active webhooks for this event
    const { data: webhooks, error } = await supabase
      .from('event_webhook_integrations')
      .select('*')
      .eq('event_id', payload.eventId)
      .eq('is_enabled', true)
      .eq('notify_on_announcement', true)

    if (error || !webhooks || webhooks.length === 0) {
      return
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campusloop.internal'
    const liveBoardUrl = `${appUrl}/events/${payload.eventSlug}/live`

    const dispatchPromises = webhooks.map(async (wh) => {
      try {
        const url = wh.webhook_url.trim()

        if (wh.platform === 'discord' || url.includes('discord.com/api/webhooks/')) {
          // Discord Embed
          const discordBody = {
            username: 'CampusLoop Live',
            avatar_url: `${appUrl}/icon.png`,
            content: payload.isPinned ? '📌 **Pinned Live Announcement**' : '📢 **New Event Announcement**',
            embeds: [
              {
                title: `${payload.eventTitle} — Update`,
                description: payload.message,
                url: liveBoardUrl,
                color: getCategoryColor(payload.category),
                fields: [
                  { name: 'Category', value: payload.category.toUpperCase(), inline: true },
                  { name: 'Live Board', value: `[View Live Stream](${liveBoardUrl})`, inline: true },
                ],
                footer: {
                  text: 'CampusLoop Event Hub',
                },
                timestamp: new Date().toISOString(),
              },
            ],
          }

          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordBody),
            signal: AbortSignal.timeout(5000),
          })
        } else if (wh.platform === 'slack' || url.includes('hooks.slack.com/services/')) {
          // Slack Block Kit
          const slackBody = {
            text: `[${payload.eventTitle}] Announcement: ${payload.message}`,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `${payload.isPinned ? '📌 Pinned: ' : '📢 '}${payload.eventTitle} Update`,
                  emoji: true,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Category:* \`${payload.category.toUpperCase()}\`\n\n${payload.message}`,
                },
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'View Live Board', emoji: true },
                    url: liveBoardUrl,
                    style: 'primary',
                  },
                ],
              },
            ],
          }

          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slackBody),
            signal: AbortSignal.timeout(5000),
          })
        } else {
          // Generic Webhook
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'event_announcement',
              eventId: payload.eventId,
              eventTitle: payload.eventTitle,
              category: payload.category,
              message: payload.message,
              isPinned: payload.isPinned,
              liveBoardUrl,
              timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(5000),
          })
        }
      } catch (whErr) {
        console.warn(`Failed to dispatch webhook ${wh.id}:`, whErr)
      }
    })

    // Execute concurrently without failing caller
    await Promise.allSettled(dispatchPromises)
  } catch (err) {
    console.error('dispatchAnnouncementWebhooks top-level error:', err)
  }
}
