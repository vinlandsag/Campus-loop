'use client'

import { useState, useTransition } from 'react'
import {
  Bell,
  Mail,
  Moon,
  ShieldAlert,
  Send,
  Check,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateNotificationPreferences } from '@/app/actions/notification.actions'
import { sendTestNotification } from '@/app/actions/settings.actions'
import type { UserNotificationPreferences } from '@/types'

interface NotificationsTabProps {
  initialPrefs: UserNotificationPreferences
  onDirtyChange?: (isDirty: boolean) => void
}

export function NotificationsTab({ initialPrefs, onDirtyChange }: NotificationsTabProps) {
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(initialPrefs)
  const [isPending, startTransition] = useTransition()
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleToggle = (key: keyof Omit<UserNotificationPreferences, 'user_id' | 'updated_at'>) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      onDirtyChange?.(true)
      return next
    })
  }

  const handleStringChange = (key: 'quiet_hours_start' | 'quiet_hours_end' | 'delivery_timezone', val: string) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: val }
      onDirtyChange?.(true)
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    startTransition(async () => {
      const res = await updateNotificationPreferences(prefs)
      if (res.success && res.data) {
        setPrefs(res.data)
        setSavedSuccess(true)
        onDirtyChange?.(false)
        toast.success('Notification preferences saved successfully!')
        setTimeout(() => setSavedSuccess(false), 3000)
      } else {
        toast.error(!res.success ? res.error : 'Failed to update preferences.')
      }
    })
  }

  const handleSendTest = async () => {
    setIsSendingTest(true)
    try {
      const res = await sendTestNotification()
      if (res.success) {
        toast.success('🔔 Test notification sent! Check your notifications bell.')
      } else {
        toast.error(res.error || 'Failed to dispatch test notification.')
      }
    } catch {
      toast.error('Could not send test notification.')
    } finally {
      setIsSendingTest(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[--text-primary]">
            Notification Channels & Schedule
          </h2>
          <p className="mt-1 text-xs text-[--text-secondary]">
            Customize how and when you receive event communications, reminders, and updates.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSendTest}
          disabled={isSendingTest}
          className="gap-2 text-xs self-start"
        >
          {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send Test Notification
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Master Channels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 flex items-start justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[--text-primary] flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-emerald-600" />
                In-App Notifications
              </span>
              <p className="text-[11px] text-[--text-muted]">
                Show alerts in the header bell and instant notification dropdown.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.in_app_enabled ?? true}
              onChange={() => handleToggle('in_app_enabled')}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 mt-1 cursor-pointer"
            />
          </div>

          <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 flex items-start justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[--text-primary] flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-blue-600" />
                Email Delivery
              </span>
              <p className="text-[11px] text-[--text-muted]">
                Send formatted event tickets and reminders to your registered institutional email.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.email_enabled}
              onChange={() => handleToggle('email_enabled')}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
            />
          </div>
        </div>

        {/* Granular Notification Matrix */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-[--border-subtle] bg-[--bg-muted]/30">
            <h3 className="text-sm font-semibold text-[--text-primary]">
              Communication Matrix by Event Type
            </h3>
            <p className="text-xs text-[--text-secondary] mt-0.5">
              Choose the exact channel for each category of event notification.
            </p>
          </div>

          <div className="divide-y divide-[--border-subtle]">
            {/* 1. Registration Confirmations */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Registration Confirmations</p>
                <p className="text-[11px] text-[--text-muted]">Instant QR ticket codes and RSVP confirmation receipts.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.registration_confirmations_in_app ?? true}
                    onChange={() => handleToggle('registration_confirmations_in_app')}
                    className="h-3.5 w-3.5 rounded text-emerald-600"
                  />
                  <span>In-App</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.registration_confirmations_email ?? true}
                    onChange={() => handleToggle('registration_confirmations_email')}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>

            {/* 2. 24-Hour Reminders */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">24-Hour Event Reminders</p>
                <p className="text-[11px] text-[--text-muted]">Directions, what to bring, and schedule details 1 day prior.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.reminders_24h_in_app ?? true}
                    onChange={() => handleToggle('reminders_24h_in_app')}
                    className="h-3.5 w-3.5 rounded text-emerald-600"
                  />
                  <span>In-App</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.reminder_24h}
                    onChange={() => handleToggle('reminder_24h')}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>

            {/* 3. 1-Hour Reminders */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">1-Hour Final Reminders</p>
                <p className="text-[11px] text-[--text-muted]">Last call notice with building and room door directions.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.reminders_1h_in_app ?? true}
                    onChange={() => handleToggle('reminders_1h_in_app')}
                    className="h-3.5 w-3.5 rounded text-emerald-600"
                  />
                  <span>In-App</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.reminder_1h}
                    onChange={() => handleToggle('reminder_1h')}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>

            {/* 4. Event Updates */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Event Updates &amp; Venue Shifts</p>
                <p className="text-[11px] text-[--text-muted]">Organizer announcements regarding agenda changes or room shifts.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.event_updates_in_app ?? true}
                    onChange={() => handleToggle('event_updates_in_app')}
                    className="h-3.5 w-3.5 rounded text-emerald-600"
                  />
                  <span>In-App</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.event_updates}
                    onChange={() => handleToggle('event_updates')}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>

            {/* 5. Waitlist Promotions */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Waitlist Promotions</p>
                <p className="text-[11px] text-[--text-muted]">Urgent notice when an attendee cancels and you claim an open spot.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.waitlist_promotions_in_app ?? true}
                    onChange={() => handleToggle('waitlist_promotions_in_app')}
                    className="h-3.5 w-3.5 rounded text-emerald-600"
                  />
                  <span>In-App</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.waitlist_promotions}
                    onChange={() => handleToggle('waitlist_promotions')}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>

            {/* 6. Followed Clubs */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Followed Clubs &amp; Organizers</p>
                <p className="text-[11px] text-[--text-muted]">New event announcements from clubs you actively follow.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.followed_clubs_in_app ?? true}
                    onChange={() => handleToggle('followed_clubs_in_app')}
                    className="h-3.5 w-3.5 rounded text-emerald-600"
                  />
                  <span>In-App</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.followed_clubs_email ?? true}
                    onChange={() => handleToggle('followed_clubs_email')}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>

            {/* 7. Friend Activity */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Friend Activity &amp; RSVPs</p>
                <p className="text-[11px] text-[--text-muted]">When accepted mutual friends register for public campus events.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.friend_activity_in_app ?? true}
                    onChange={() => handleToggle('friend_activity_in_app')}
                    className="h-3.5 w-3.5 rounded text-emerald-600"
                  />
                  <span>In-App</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.friend_activity_email ?? false}
                    onChange={() => handleToggle('friend_activity_email')}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>

            {/* 8. Marketing Announcements */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Campus Highlights &amp; Digest</p>
                <p className="text-[11px] text-[--text-muted]">Curated weekly campus festival recaps and platform improvements.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.marketing_announcements}
                    onChange={() => handleToggle('marketing_announcements')}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Hours & Delivery Timezone */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[--text-primary] flex items-center gap-1.5">
                <Moon className="h-4 w-4 text-indigo-600" />
                Quiet Hours &amp; Timezone Scheduling
              </span>
              <p className="text-[11px] text-[--text-muted]">
                Hold non-urgent notification emails and push alerts during your sleeping or study hours.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.quiet_hours_enabled ?? false}
              onChange={() => handleToggle('quiet_hours_enabled')}
              className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
            />
          </div>

          {prefs.quiet_hours_enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[--border-subtle]">
              <div className="space-y-1.5">
                <Label htmlFor="quiet-start" className="text-xs">
                  Quiet Hours Start
                </Label>
                <input
                  id="quiet-start"
                  type="time"
                  value={prefs.quiet_hours_start || '22:00'}
                  onChange={(e) => handleStringChange('quiet_hours_start', e.target.value)}
                  className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2 text-xs text-[--text-primary]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quiet-end" className="text-xs">
                  Quiet Hours End
                </Label>
                <input
                  id="quiet-end"
                  type="time"
                  value={prefs.quiet_hours_end || '08:00'}
                  onChange={(e) => handleStringChange('quiet_hours_end', e.target.value)}
                  className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2 text-xs text-[--text-primary]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delivery-tz" className="text-xs">
                  Preferred Timezone
                </Label>
                <select
                  id="delivery-tz"
                  value={prefs.delivery_timezone || 'UTC'}
                  onChange={(e) => handleStringChange('delivery_timezone', e.target.value)}
                  className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2 text-xs text-[--text-primary]"
                >
                  <option value="UTC">UTC (Universal)</option>
                  <option value="America/New_York">Eastern Time (US/Canada)</option>
                  <option value="America/Chicago">Central Time (US/Canada)</option>
                  <option value="America/Denver">Mountain Time (US/Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US/Canada)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Central Europe (CET/CEST)</option>
                  <option value="Asia/Kolkata">India Standard Time (IST)</option>
                  <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Mandatory Safety Override Disclaimer */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Campus Physical Safety &amp; Emergency Policy
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Critical event cancellations, emergency safety broadcasts, and mandatory physical venue relocations strictly override quiet hours and opt-out preferences to protect student safety.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Notification preferences saved!
            </span>
          )}
          {!savedSuccess && <span />}

          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Notification Settings
          </Button>
        </div>
      </form>
    </div>
  )
}
