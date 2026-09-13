import type { InAppNotification, NotificationType } from '@/types'

export interface CreateNotificationInput {
  userId: string
  eventId?: string | null
  type: NotificationType
  title: string
  message: string
  link?: string | null
}

export interface NotifyAttendeesInput {
  eventId: string
  type: NotificationType
  title: string
  message: string
  link?: string | null
}

export interface INotificationService {
  /** Send a notification to a specific user */
  send(input: CreateNotificationInput): Promise<boolean>

  /** Send multiple notifications in batch */
  sendBatch(inputs: CreateNotificationInput[]): Promise<{ count: number; error?: string }>

  /** Notify all active registered attendees of an event */
  notifyAttendees(input: NotifyAttendeesInput): Promise<{ recipientCount: number }>

  /** Get notifications for a user */
  getNotificationsForUser(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<InAppNotification[]>

  /** Get count of unread notifications for a user */
  getUnreadCount(userId: string): Promise<number>

  /** Mark a single notification as read */
  markAsRead(notificationId: string, userId: string): Promise<boolean>

  /** Mark all notifications as read for a user */
  markAllAsRead(userId: string): Promise<boolean>
}
