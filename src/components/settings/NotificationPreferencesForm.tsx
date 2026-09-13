'use client'

import { useState, useTransition } from 'react'
import {
  Mail,
  Clock,
  Calendar,
  Save,
  Check,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { updateNotificationPreferences } from '@/app/actions/notification.actions'
import type { UserNotificationPreferences } from '@/types'

interface NotificationPreferencesFormProps {
  initialPreferences: UserNotificationPreferences
}

export function NotificationPreferencesForm({
  initialPreferences,
}: NotificationPreferencesFormProps) {
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(initialPreferences)
  const [isPending, startTransition] = useTransition()
  const [isSaved, setIsSaved] = useState(false)

  const handleToggle = (key: keyof Omit<UserNotificationPreferences, 'user_id' | 'updated_at'>) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
    setIsSaved(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateNotificationPreferences(prefs)
      if (result.success) {
        setPrefs(result.data)
        setIsSaved(true)
        toast.success('Notification preferences updated successfully!')
        setTimeout(() => setIsSaved(false), 3000)
      } else {
        toast.error(result.error || 'Failed to save preferences.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Email Master Toggle */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-[--text-primary]">
                Email Notifications
              </h3>
              <p className="mt-1 text-xs text-[--text-secondary]">
                Receive event communications and reminders directly at your registered campus email address.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={prefs.email_enabled}
            onClick={() => handleToggle('email_enabled')}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
              prefs.email_enabled ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                prefs.email_enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Reminder Timers */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[--border-subtle] pb-4">
          <Clock className="h-4 w-4 text-emerald-600" />
          <h3 className="font-display text-base font-semibold text-[--text-primary]">
            Event Reminders
          </h3>
        </div>

        <div className="divide-y divide-[--border-subtle]">
          {/* 24h Reminder */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-[--text-primary]">
                24-Hour Reminder
              </p>
              <p className="text-xs text-[--text-secondary]">
                Receive a reminder 1 day before the event with directions and venue instructions.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.reminder_24h}
              onClick={() => handleToggle('reminder_24h')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                prefs.reminder_24h ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  prefs.reminder_24h ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 1h Reminder */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-[--text-primary]">
                1-Hour Final Call
              </p>
              <p className="text-xs text-[--text-secondary]">
                Receive a quick alert 1 hour prior to start with your admission pass ready.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.reminder_1h}
              onClick={() => handleToggle('reminder_1h')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                prefs.reminder_1h ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  prefs.reminder_1h ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Critical Updates & Waitlist */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[--border-subtle] pb-4">
          <Calendar className="h-4 w-4 text-emerald-600" />
          <h3 className="font-display text-base font-semibold text-[--text-primary]">
            Event Changes & Waitlist
          </h3>
        </div>

        <div className="divide-y divide-[--border-subtle]">
          {/* Event updates */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-[--text-primary]">
                Event Updates & Changes
              </p>
              <p className="text-xs text-[--text-secondary]">
                Get notified if the venue changes, the event is rescheduled, or if the organizer posts a change notice.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.event_updates}
              onClick={() => handleToggle('event_updates')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                prefs.event_updates ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  prefs.event_updates ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Waitlist promotions */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-[--text-primary]">
                Waitlist Auto-Promotions
              </p>
              <p className="text-xs text-[--text-secondary]">
                Instant notification when an attendee cancels and your waitlist spot is automatically upgraded to confirmed.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.waitlist_promotions}
              onClick={() => handleToggle('waitlist_promotions')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                prefs.waitlist_promotions ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  prefs.waitlist_promotions ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Marketing Announcements */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-[--text-primary]">
                Club & Campus Announcements
              </p>
              <p className="text-xs text-[--text-secondary]">
                Receive periodic highlights, upcoming club meetings, and special campus announcements.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.marketing_announcements}
              onClick={() => handleToggle('marketing_announcements')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                prefs.marketing_announcements ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  prefs.marketing_announcements ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Transactional Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
        <div>
          <span className="font-semibold">Guaranteed Transactional Alerts:</span> Direct confirmations of your registrations, admission ticket releases, check-in confirmations, and event cancellations are always guaranteed in your in-app inbox to protect admission safety.
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 text-sm"
        >
          {isSaved ? (
            <>
              <Check className="h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {isPending ? 'Saving...' : 'Save Preferences'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
