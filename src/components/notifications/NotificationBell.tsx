'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Check,
  Calendar,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/app/actions/notification.actions'
import type { InAppNotification, NotificationType } from '@/types'
import { cn } from '@/lib/utils'

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'registration_confirmed':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case 'event_cancelled':
      return <AlertTriangle className="h-4 w-4 text-rose-500" />
    case 'event_rescheduled':
      return <Calendar className="h-4 w-4 text-amber-500" />
    case 'venue_changed':
      return <MapPin className="h-4 w-4 text-blue-500" />
    default:
      return <Bell className="h-4 w-4 text-[--accent-500]" />
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHour < 24) return `${diffHour}h ago`
    if (diffDay < 7) return `${diffDay}d ago`
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return 'Recently'
  }
}

export function NotificationBell() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    const res = await getUserNotifications(15)
    if (res.success) {
      setNotifications(res.data)
      setUnreadCount(res.unreadCount)
    }
  }

  // Initial load and periodic refresh
  useEffect(() => {
    let mounted = true

    getUserNotifications(15).then((res) => {
      if (mounted && res.success) {
        setNotifications(res.data)
        setUnreadCount(res.unreadCount)
      }
    })

    const interval = setInterval(() => {
      getUserNotifications(15).then((res) => {
        if (mounted && res.success) {
          setNotifications(res.data)
          setUnreadCount(res.unreadCount)
        }
      })
    }, 60000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const toggleDropdown = async () => {
    if (!isOpen) {
      setIsOpen(true)
      setIsLoading(true)
      await fetchNotifications()
      setIsLoading(false)
    } else {
      setIsOpen(false)
    }
  }

  const handleMarkAllRead = () => {
    startTransition(async () => {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
      await markAllNotificationsAsRead()
    })
  }

  const handleNotificationClick = async (notification: InAppNotification) => {
    if (!notification.is_read) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      await markNotificationAsRead(notification.id)
    }

    if (notification.link) {
      setIsOpen(false)
      router.push(notification.link)
    }
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={toggleDropdown}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[--text-secondary] transition-colors hover:bg-[--bg-muted] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent-500]"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[--bg-surface]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 whitespace-normal break-words"
          role="region"
          aria-label="Notifications list"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[--border-subtle] px-4 py-3 bg-[--bg-muted]/40">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-sm text-[--text-primary]">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[--accent-500]/10 px-2 py-0.5 text-xs font-medium text-[--accent-600] dark:text-[--accent-400]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="flex items-center gap-1 text-xs text-[--text-secondary] hover:text-[--text-primary] transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[--border-subtle]">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-[--text-muted]">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-xs">Loading updates...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center px-4">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-[--bg-muted] text-[--text-muted] mb-2">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-[--text-secondary]">No notifications yet</p>
                <p className="text-[11px] text-[--text-muted] mt-1">
                  Updates on event registrations, cancellations, and schedule changes will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'flex items-start gap-3 p-3.5 text-left transition-colors cursor-pointer hover:bg-[--bg-muted]/60',
                      !notification.is_read && 'bg-[--accent-500]/5 dark:bg-[--accent-500]/10'
                    )}
                  >
                    {/* Icon */}
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[--bg-muted]">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={cn(
                            'text-xs font-medium truncate',
                            !notification.is_read
                              ? 'text-[--text-primary] font-semibold'
                              : 'text-[--text-secondary]'
                          )}
                        >
                          {notification.title}
                        </h4>
                        <span className="text-[10px] text-[--text-muted] whitespace-nowrap">
                          {formatRelativeTime(notification.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-[--text-secondary] leading-relaxed line-clamp-3">
                        {notification.message}
                      </p>

                      {notification.link && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[--accent-600] dark:text-[--accent-400] pt-0.5">
                          View event
                          <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>

                    {/* Unread indicator */}
                    {!notification.is_read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[--accent-500]" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
