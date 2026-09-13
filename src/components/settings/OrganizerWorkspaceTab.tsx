'use client'

import { useState, useTransition } from 'react'
import {
  MapPin,
  Clock,
  Layers,
  Accessibility,
  Mail,
  Bell,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateOrganizerWorkspaceSettings } from '@/app/actions/settings.actions'
import type { OrganizerWorkspaceSettings, CampusVenue } from '@/types'
import { EVENT_CATEGORIES } from '@/lib/constants'

interface OrganizerWorkspaceTabProps {
  initialSettings: OrganizerWorkspaceSettings | null
  venues: CampusVenue[]
  onDirtyChange?: (isDirty: boolean) => void
}

export function OrganizerWorkspaceTab({
  initialSettings,
  venues,
  onDirtyChange,
}: OrganizerWorkspaceTabProps) {
  const [timezone, setTimezone] = useState(initialSettings?.default_timezone || 'UTC')
  const [venueId, setVenueId] = useState(initialSettings?.default_venue_id || '')
  const [category, setCategory] = useState(initialSettings?.default_category || 'Academic')
  const [accessibility, setAccessibility] = useState(
    initialSettings?.default_accessibility_statement || ''
  )
  const [contactEmail, setContactEmail] = useState(
    initialSettings?.default_contact_email || ''
  )

  const [notifyRegistration, setNotifyRegistration] = useState(
    initialSettings?.notify_on_new_registration ?? true
  )
  const [notifyVolunteer, setNotifyVolunteer] = useState(
    initialSettings?.notify_on_volunteer_application ?? true
  )
  const [notifyFeedback, setNotifyFeedback] = useState(
    initialSettings?.notify_on_event_feedback ?? true
  )
  const [teamInvitesEnabled, setTeamInvitesEnabled] = useState(
    initialSettings?.default_team_invites_enabled ?? true
  )

  const [isPending, startTransition] = useTransition()
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    startTransition(async () => {
      const res = await updateOrganizerWorkspaceSettings({
        default_timezone: timezone,
        default_venue_id: venueId || null,
        default_category: category,
        default_accessibility_statement: accessibility.trim() || null,
        default_contact_email: contactEmail.trim() || null,
        notify_on_new_registration: notifyRegistration,
        notify_on_volunteer_application: notifyVolunteer,
        notify_on_event_feedback: notifyFeedback,
        default_team_invites_enabled: teamInvitesEnabled,
      })

      if (res.success) {
        setSavedSuccess(true)
        onDirtyChange?.(false)
        toast.success('Organizer workspace defaults saved!')
        setTimeout(() => setSavedSuccess(false), 3000)
      } else {
        toast.error(res.error || 'Failed to save workspace defaults.')
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-bold text-[--text-primary]">
          Organizer Workspace Defaults
        </h2>
        <p className="mt-1 text-xs text-[--text-secondary]">
          Pre-populate event creation templates, automated coordinator alerts, and team collaboration defaults.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Creation Template Defaults */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Event Creation Template Defaults
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="default_tz" className="text-xs flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-500" /> Default Timezone
              </Label>
              <select
                id="default_tz"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value)
                  onDirtyChange?.(true)
                }}
                className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2.5 text-xs text-[--text-primary]"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (Eastern)</option>
                <option value="America/Chicago">America/Chicago (Central)</option>
                <option value="America/Denver">America/Denver (Mountain)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="default_category" className="text-xs flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-zinc-500" /> Default Event Category
              </Label>
              <select
                id="default_category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value)
                  onDirtyChange?.(true)
                }}
                className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2.5 text-xs text-[--text-primary]"
              >
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="default_venue" className="text-xs flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" /> Default Campus Venue
              </Label>
              <select
                id="default_venue"
                value={venueId}
                onChange={(e) => {
                  setVenueId(e.target.value)
                  onDirtyChange?.(true)
                }}
                className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2.5 text-xs text-[--text-primary]"
              >
                <option value="">No default venue (Select per event)</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.building || 'Campus'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact_email" className="text-xs flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-zinc-500" /> Default Inquiries Email
              </Label>
              <Input
                id="contact_email"
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value)
                  onDirtyChange?.(true)
                }}
                placeholder="inquiries@club.campus.edu"
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accessibility" className="text-xs flex items-center gap-1.5">
              <Accessibility className="h-3.5 w-3.5 text-zinc-500" /> Standard Accessibility Accommodation Statement
            </Label>
            <textarea
              id="accessibility"
              rows={2}
              value={accessibility}
              onChange={(e) => {
                setAccessibility(e.target.value)
                onDirtyChange?.(true)
              }}
              placeholder="e.g. Wheelchair accessible ramp at west entrance. ASL interpreters available upon request 48h prior."
              className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2.5 text-xs text-[--text-primary]"
            />
          </div>
        </div>

        {/* Organizer Operational Alerts */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
            <Bell className="h-4 w-4 text-indigo-600" />
            Organizer Operational Alerts
          </h3>

          <div className="space-y-3 divide-y divide-[--border-subtle]">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Attendee Registration Notifications</p>
                <p className="text-[11px] text-[--text-muted]">Receive a notification digest when new students RSVP.</p>
              </div>
              <input
                type="checkbox"
                checked={notifyRegistration}
                onChange={(e) => {
                  setNotifyRegistration(e.target.checked)
                  onDirtyChange?.(true)
                }}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Volunteer Application Alerts</p>
                <p className="text-[11px] text-[--text-muted]">Alert coordinator when students apply for volunteer shifts.</p>
              </div>
              <input
                type="checkbox"
                checked={notifyVolunteer}
                onChange={(e) => {
                  setNotifyVolunteer(e.target.checked)
                  onDirtyChange?.(true)
                }}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Post-Event Rating &amp; Feedback Alerts</p>
                <p className="text-[11px] text-[--text-muted]">Immediate notification if an attendee flags an issue or submits a review.</p>
              </div>
              <input
                type="checkbox"
                checked={notifyFeedback}
                onChange={(e) => {
                  setNotifyFeedback(e.target.checked)
                  onDirtyChange?.(true)
                }}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="text-xs font-semibold text-[--text-primary]">Allow Team Invite Codes by Default</p>
                <p className="text-[11px] text-[--text-muted]">Enable group &amp; team leader invites on new team-based events.</p>
              </div>
              <input
                type="checkbox"
                checked={teamInvitesEnabled}
                onChange={(e) => {
                  setTeamInvitesEnabled(e.target.checked)
                  onDirtyChange?.(true)
                }}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-1">
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Workspace defaults saved!
            </span>
          )}
          {!savedSuccess && <span />}

          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Workspace Defaults
          </Button>
        </div>
      </form>
    </div>
  )
}
