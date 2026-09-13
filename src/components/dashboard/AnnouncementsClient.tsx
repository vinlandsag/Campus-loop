'use client'

import { useState, useTransition } from 'react'
import {
  Megaphone,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  BellRing,
  History,
  Pin,
  Radio,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { sendEventAnnouncement } from '@/app/actions/announcement.actions'
import type { EventAnnouncement, AnnouncementTargetFilter, AnnouncementCategory } from '@/types'

interface AnnouncementsClientProps {
  eventId: string
  eventTitle: string
  eventSlug: string
  initialAnnouncements: EventAnnouncement[]
}

const CATEGORY_LABELS: Record<AnnouncementCategory, { label: string; badgeColor: string }> = {
  general: { label: 'General Update', badgeColor: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  venue_change: { label: 'Venue Change', badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  schedule: { label: 'Schedule Update', badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300' },
  session_start: { label: 'Session Starting', badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
  food: { label: 'Food & Refreshments', badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300' },
  emergency: { label: 'Emergency Notice', badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' },
}

const FILTER_LABELS: Record<
  AnnouncementTargetFilter,
  { label: string; badgeColor: string; description: string }
> = {
  all: {
    label: 'All Attendees',
    badgeColor: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
    description: 'Broadcasts to all confirmed attendees and waitlist candidates.',
  },
  registered: {
    label: 'Confirmed Registrations',
    badgeColor: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
    description: 'Sends only to registered attendees who have not yet checked in.',
  },
  checked_in: {
    label: 'Checked-In Attendees',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    description: 'Sends only to attendees who have checked in at the venue.',
  },
  waitlisted: {
    label: 'Waitlist Candidates',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    description: 'Sends updates specifically to attendees waiting in the queue.',
  },
}

export function AnnouncementsClient({
  eventId,
  eventTitle,
  eventSlug,
  initialAnnouncements,
}: AnnouncementsClientProps) {
  const [announcements, setAnnouncements] = useState<EventAnnouncement[]>(initialAnnouncements)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetFilter, setTargetFilter] = useState<AnnouncementTargetFilter>('all')
  const [category, setCategory] = useState<AnnouncementCategory>('general')
  const [isPinned, setIsPinned] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (title.trim().length < 3) {
      setError('Announcement title must be at least 3 characters.')
      return
    }
    if (message.trim().length < 5) {
      setError('Announcement message must be at least 5 characters.')
      return
    }

    startTransition(async () => {
      const result = await sendEventAnnouncement(
        eventId,
        title,
        message,
        targetFilter,
        isPinned,
        category
      )
      if (result.success) {
        toast.success(`Announcement broadcast to ${result.recipientCount} attendees!`, {
          description: isPinned ? 'Pinned to the Live Event Board and notified attendees.' : 'In-app notifications have been delivered.',
        })
        const newEntry: EventAnnouncement = {
          id: `temp-${Date.now()}`,
          event_id: eventId,
          title: title.trim(),
          message: message.trim(),
          target_filter: targetFilter,
          category,
          is_pinned: isPinned,
          recipient_count: result.recipientCount || 0,
          created_at: new Date().toISOString(),
        }
        setAnnouncements((prev) => [newEntry, ...prev])
        setTitle('')
        setMessage('')
        setIsPinned(false)
        setCategory('general')
      } else {
        setError(result.error || 'Failed to send announcement.')
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Broadcast Form */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-[--text-primary]">
            Broadcast Attendee Announcement
          </h2>
        </div>
        <p className="text-xs text-[--text-secondary] mb-6">
          Deliver instant in-app notifications directly to attendees of{' '}
          <span className="font-semibold text-[--text-primary]">{eventTitle}</span>.
        </p>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <Label htmlFor="ann-title" className="text-xs font-semibold">
                Announcement Subject / Headline
              </Label>
              <Input
                id="ann-title"
                type="text"
                placeholder="e.g. Room Changed to Hall B, Lunch is Served, Keynote Starting..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 text-sm font-medium"
              />
            </div>

            <div className="sm:col-span-3">
              <Label htmlFor="ann-category" className="text-xs font-semibold">
                Category
              </Label>
              <select
                id="ann-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="general">General Update</option>
                <option value="venue_change">Venue Change</option>
                <option value="session_start">Session Starting</option>
                <option value="food">Food & Refreshments</option>
                <option value="emergency">Emergency Notice</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <Label htmlFor="ann-target" className="text-xs font-semibold">
                Target Audience
              </Label>
              <select
                id="ann-target"
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value as AnnouncementTargetFilter)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Attendees</option>
                <option value="registered">Confirmed Registrations</option>
                <option value="checked_in">Checked-In Attendees</option>
                <option value="waitlisted">Waitlist Candidates</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="ann-message" className="text-xs font-semibold">
              Announcement Message
            </Label>
            <textarea
              id="ann-message"
              rows={3}
              placeholder="Write your announcement message here. Attendees will receive this in their notifications, and pinned items appear on the Live Event Board."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Pinned Update Option */}
          <div className="flex items-center justify-between rounded-xl border border-[--border-subtle] bg-[--bg-muted]/60 p-3.5">
            <div className="flex items-center gap-3">
              <input
                id="ann-pinned"
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
              <div>
                <Label htmlFor="ann-pinned" className="text-xs font-bold text-[--text-primary] cursor-pointer flex items-center gap-1.5">
                  <Pin className="h-3.5 w-3.5 text-rose-500" />
                  Pin to Live Event Board
                </Label>
                <p className="text-[11px] text-[--text-secondary]">
                  Highlights this announcement at the top of the attendee live stream (/events/{eventSlug}/live).
                </p>
              </div>
            </div>

            <Badge variant="outline" className={CATEGORY_LABELS[category].badgeColor}>
              {CATEGORY_LABELS[category].label}
            </Badge>
          </div>

          {/* Target Audience Note */}
          <div className="flex items-center justify-between rounded-xl bg-[--bg-muted] p-3 text-xs text-[--text-secondary]">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[--text-muted]" />
              <span>{FILTER_LABELS[targetFilter].description}</span>
            </div>

            <Badge variant="outline" className={FILTER_LABELS[targetFilter].badgeColor}>
              {FILTER_LABELS[targetFilter].label}
            </Badge>
          </div>

          {/* Submit & Live Board Link */}
          <div className="flex items-center justify-between pt-2">
            <Link
              href={`/events/${eventSlug}/live`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span>Open Public Live Board ↗</span>
            </Link>

            <Button
              type="submit"
              disabled={isPending || !title.trim() || !message.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium"
            >
              <Send className="h-4 w-4" />
              {isPending ? 'Broadcasting...' : 'Broadcast Announcement'}
            </Button>
          </div>
        </form>
      </div>

      {/* Announcement History */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm overflow-hidden">
        <div className="border-b border-[--border-subtle] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[--text-muted]" />
            <h3 className="font-semibold text-sm text-[--text-primary]">
              Past Announcements History
            </h3>
          </div>
          <span className="text-xs text-[--text-muted]">
            {announcements.length} sent
          </span>
        </div>

        <div className="divide-y divide-[--border-subtle]">
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-xs text-[--text-muted]">
              No announcements have been broadcast for this event yet.
            </div>
          ) : (
            announcements.map((ann) => {
              const filterMeta = FILTER_LABELS[ann.target_filter] || FILTER_LABELS.all
              const categoryMeta =
                CATEGORY_LABELS[ann.category as AnnouncementCategory] || CATEGORY_LABELS.general

              return (
                <div key={ann.id} className="p-5 space-y-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BellRing className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-semibold text-sm text-[--text-primary]">
                        {ann.title}
                      </h4>
                      {ann.is_pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          <Pin className="h-2.5 w-2.5" />
                          PINNED
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${categoryMeta.badgeColor}`}>
                        {categoryMeta.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={filterMeta.badgeColor}>
                        {filterMeta.label}
                      </Badge>
                      <span className="text-xs font-mono text-[--text-muted]">
                        {new Date(ann.created_at).toLocaleDateString()} at{' '}
                        {new Date(ann.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[--text-secondary] leading-relaxed pl-6">
                    {ann.message}
                  </p>

                  <div className="pl-6 pt-1 flex items-center gap-1.5 text-[11px] text-[--text-muted]">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>Delivered to {ann.recipient_count} attendee notification feeds</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
