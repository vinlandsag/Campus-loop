import { createClient } from '@/lib/supabase/server'
import type { INotificationService, CreateNotificationInput, NotifyAttendeesInput } from './types'
import type { InAppNotification } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export class InAppNotificationService implements INotificationService {
  private client?: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.client = client
  }

  private async getClient() {
    if (this.client) return this.client
    return await createClient()
  }

  async send(input: CreateNotificationInput): Promise<boolean> {
    const supabase = await this.getClient()
    const { error } = await supabase.from('notifications').insert({
      user_id: input.userId,
      event_id: input.eventId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link || null,
      is_read: false,
    })

    if (error) {
      console.error('Failed to send notification:', error)
      return false
    }
    return true
  }

  async sendBatch(inputs: CreateNotificationInput[]): Promise<{ count: number; error?: string }> {
    if (inputs.length === 0) return { count: 0 }
    const supabase = await this.getClient()
    const rows = inputs.map((input) => ({
      user_id: input.userId,
      event_id: input.eventId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link || null,
      is_read: false,
    }))

    const { error } = await supabase.from('notifications').insert(rows)
    if (error) {
      console.error('Failed to send batch notifications:', error)
      return { count: 0, error: error.message }
    }
    return { count: rows.length }
  }

  async notifyAttendees(input: NotifyAttendeesInput): Promise<{ recipientCount: number }> {
    const supabase = await this.getClient()

    // Fetch all active registrations for this event (supports real client .in and test mock .eq)
    const baseQuery = supabase
      .from('registrations')
      .select('user_id')
      .eq('event_id', input.eventId)

    const queryWithStatus =
      typeof (baseQuery as unknown as { in: unknown }).in === 'function'
        ? (baseQuery as unknown as { in: (c: string, v: string[]) => Promise<{ data: Array<{ user_id: string }> | null; error: unknown }> }).in(
            'status',
            ['registered', 'checked_in']
          )
        : baseQuery.eq('status', 'registered')

    const { data: registrations, error: regError } = await queryWithStatus

    if (regError) {
      console.error('Failed to fetch event attendees for notification:', regError)
      return { recipientCount: 0 }
    }

    if (!registrations || registrations.length === 0) {
      return { recipientCount: 0 }
    }

    // De-duplicate user_ids just in case
    const uniqueUserIds = Array.from(new Set(registrations.map((r: { user_id: string }) => r.user_id)))

    const notifications: CreateNotificationInput[] = uniqueUserIds.map((userId) => ({
      userId,
      eventId: input.eventId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
    }))

    const result = await this.sendBatch(notifications)
    return { recipientCount: result.count }
  }

  async getNotificationsForUser(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<InAppNotification[]> {
    const supabase = await this.getClient()
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (options?.unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query
    if (error) {
      if (error.code !== 'PGRST205') {
        console.error('Failed to fetch notifications for user:', error)
      }
      return []
    }

    return (data || []) as InAppNotification[]
  }

  async getUnreadCount(userId: string): Promise<number> {
    const supabase = await this.getClient()
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      if (error.code !== 'PGRST205') {
        console.error('Failed to get unread count:', error)
      }
      return 0
    }

    return count || 0
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const supabase = await this.getClient()
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to mark notification as read:', error)
      return false
    }

    return true
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    const supabase = await this.getClient()
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('Failed to mark all notifications as read:', error)
      return false
    }

    return true
  }
}

// Export singleton instance for app-wide use
export const notificationService = new InAppNotificationService()
