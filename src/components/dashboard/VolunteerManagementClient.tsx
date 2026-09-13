'use client'

import { useState, useTransition } from 'react'
import {
  HeartHandshake,
  Plus,
  Trash2,
  Users,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  createVolunteerRole,
  deleteVolunteerRole,
  updateVolunteerSignupStatus,
} from '@/app/actions/volunteer.actions'
import type {
  EventVolunteerRole,
  EventVolunteerSignup,
  VolunteerSignupStatus,
} from '@/types'

interface VolunteerManagementClientProps {
  eventId: string
  eventTitle: string
  initialRoles: EventVolunteerRole[]
  initialSignups: EventVolunteerSignup[]
  canManage: boolean
  canCheckIn: boolean
}

export function VolunteerManagementClient({
  eventId,
  eventTitle,
  initialRoles,
  initialSignups,
  canManage,
  canCheckIn,
}: VolunteerManagementClientProps) {
  const [roles, setRoles] = useState<EventVolunteerRole[]>(initialRoles)
  const [signups, setSignups] = useState<EventVolunteerSignup[]>(initialSignups)
  const [activeTab, setActiveTab] = useState<'roster' | 'roles'>('roster')

  // New role form state
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')
  const [capacity, setCapacity] = useState('5')
  const [skillsInput, setSkillsInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (title.trim().length < 2) {
      setError('Role title is required.')
      return
    }

    const capNum = parseInt(capacity, 10)
    if (isNaN(capNum) || capNum < 1) {
      setError('Capacity must be at least 1.')
      return
    }

    const formattedSkills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(', ')

    startTransition(async () => {
      const res = await createVolunteerRole(eventId, {
        title: title.trim(),
        description: description.trim() || null,
        shift_start: shiftStart ? new Date(shiftStart).toISOString() : null,
        shift_end: shiftEnd ? new Date(shiftEnd).toISOString() : null,
        capacity: capNum,
        required_skills: formattedSkills || null,
      })

      if (res.success && res.data) {
        toast.success(`Volunteer role "${res.data.title}" created!`)
        setRoles((prev) => [...prev, res.data!])
        setTitle('')
        setDescription('')
        setShiftStart('')
        setShiftEnd('')
        setCapacity('5')
        setSkillsInput('')
        setShowRoleForm(false)
      } else {
        const errorMsg = !res.success ? res.error : undefined
        setError(errorMsg || 'Failed to create volunteer role.')
      }
    })
  }

  const handleDeleteRole = (roleId: string, roleTitle: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleTitle}"?`)) return

    startTransition(async () => {
      const res = await deleteVolunteerRole(roleId, eventId)
      if (res.success) {
        toast.success(`Role "${roleTitle}" deleted.`)
        setRoles((prev) => prev.filter((r) => r.id !== roleId))
        setSignups((prev) => prev.filter((s) => s.role_id !== roleId))
      } else {
        const errorMsg = !res.success ? res.error : undefined
        toast.error(errorMsg || 'Failed to delete role.')
      }
    })
  }

  const handleStatusChange = (
    signupId: string,
    newStatus: VolunteerSignupStatus
  ) => {
    startTransition(async () => {
      const res = await updateVolunteerSignupStatus(signupId, eventId, newStatus)
      if (res.success && res.data) {
        toast.success(`Volunteer status updated to ${newStatus}`)
        setSignups((prev) =>
          prev.map((s) => (s.id === signupId ? { ...s, status: newStatus } : s))
        )
      } else {
        const errorMsg = !res.success ? res.error : undefined
        toast.error(errorMsg || 'Failed to update volunteer status.')
      }
    })
  }

  const roleMap = new Map<string, EventVolunteerRole>()
  roles.forEach((r) => roleMap.set(r.id, r))

  const pendingCount = signups.filter((s) => s.status === 'pending').length
  const approvedCount = signups.filter((s) => s.status === 'approved').length
  const checkedInCount = signups.filter((s) => s.status === 'checked_in').length

  return (
    <div className="space-y-6">
      {/* Top Stat Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 shadow-sm">
          <p className="text-xs text-[--text-muted]">Configured Roles</p>
          <p className="mt-1 font-display text-2xl font-bold text-[--text-primary]">
            {roles.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 shadow-sm">
          <p className="text-xs text-amber-600 dark:text-amber-400">Pending Review</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
            {pendingCount}
          </p>
        </div>
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 shadow-sm">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Approved Crew</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {approvedCount}
          </p>
        </div>
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 shadow-sm">
          <p className="text-xs text-blue-600 dark:text-blue-400">Checked In On-Duty</p>
          <p className="mt-1 font-display text-2xl font-bold text-blue-600 dark:text-blue-400">
            {checkedInCount}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[--border-subtle]">
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'roster'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          }`}
        >
          Volunteer Applications & Roster ({signups.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          }`}
        >
          Roles & Shift Config ({roles.length})
        </button>
      </div>

      {/* TAB 1: ROSTER & APPLICATIONS */}
      {activeTab === 'roster' && (
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm overflow-hidden">
          <div className="border-b border-[--border-subtle] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[--text-muted]" />
              <h3 className="font-semibold text-sm text-[--text-primary]">
                Volunteer Signups & Status: {eventTitle}
              </h3>
            </div>
          </div>

          {signups.length === 0 ? (
            <div className="p-10 text-center text-xs text-[--text-muted]">
              <HeartHandshake className="h-8 w-8 mx-auto mb-2 opacity-40 text-amber-500" />
              <p className="font-medium text-[--text-secondary]">No volunteer signups yet.</p>
              <p className="mt-1">
                Students can browse and apply for open shifts on the public event page.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[--bg-muted] text-[--text-secondary] uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">Volunteer</th>
                    <th className="px-6 py-3">Assigned Role</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Applicant Notes</th>
                    <th className="px-6 py-3">Shift Timing</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-subtle]">
                  {signups.map((s) => {
                    const role = s.role || roleMap.get(s.role_id)
                    return (
                      <tr key={s.id} className="hover:bg-[--bg-muted]/40 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-[--text-primary]">
                            {s.user?.full_name || 'Volunteer Applicant'}
                          </p>
                          <p className="text-[11px] text-[--text-muted]">{s.user?.email}</p>
                        </td>
                        <td className="px-6 py-3.5 font-medium text-[--text-primary]">
                          {role?.title || 'Unknown Role'}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              s.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : s.status === 'checked_in'
                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                : s.status === 'declined'
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {s.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 max-w-xs text-[--text-secondary]">
                          {s.notes || <span className="italic text-[--text-muted]">None</span>}
                        </td>
                        <td className="px-6 py-3.5 text-[--text-muted] whitespace-nowrap">
                          {role?.shift_start
                            ? new Date(role.shift_start).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : 'Flexible'}
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {canManage && s.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(s.id, 'approved')}
                                disabled={isPending}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleStatusChange(s.id, 'declined')}
                                disabled={isPending}
                                className="rounded-lg border border-[--border-subtle] px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {canCheckIn && (s.status === 'approved' || s.status === 'checked_in') && (
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  s.id,
                                  s.status === 'checked_in' ? 'approved' : 'checked_in'
                                )
                              }
                              disabled={isPending}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                                s.status === 'checked_in'
                                  ? 'border border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {s.status === 'checked_in' ? 'Check Out' : 'Check In'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ROLE CONFIGURATION */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm text-[--text-primary]">
              Event Volunteer Roles & Shift Requirements
            </h3>
            {canManage && (
              <Button
                size="sm"
                onClick={() => setShowRoleForm(!showRoleForm)}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {showRoleForm ? 'Hide Role Form' : 'Add Volunteer Role'}
              </Button>
            )}
          </div>

          {/* New Role Form */}
          {showRoleForm && (
            <form
              onSubmit={handleCreateRole}
              className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm space-y-4"
            >
              <h4 className="font-bold text-sm text-[--text-primary]">Create New Volunteer Role</h4>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <Label htmlFor="role-title" className="text-xs font-semibold">
                    Role Title
                  </Label>
                  <Input
                    id="role-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Registration Desk Assistant, Technical Stage Coordinator"
                    required
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-4">
                  <Label htmlFor="role-capacity" className="text-xs font-semibold">
                    Max Capacity (Volunteers)
                  </Label>
                  <Input
                    id="role-capacity"
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-6">
                  <Label htmlFor="shift-start" className="text-xs font-semibold">
                    Shift Start (Optional)
                  </Label>
                  <Input
                    id="shift-start"
                    type="datetime-local"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-6">
                  <Label htmlFor="shift-end" className="text-xs font-semibold">
                    Shift End (Optional)
                  </Label>
                  <Input
                    id="shift-end"
                    type="datetime-local"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-12">
                  <Label htmlFor="role-skills" className="text-xs font-semibold">
                    Required Skills / Tags (comma separated)
                  </Label>
                  <Input
                    id="role-skills"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder="e.g. Audio/Visual, First Aid, Check-in Scanning, Photography"
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-12">
                  <Label htmlFor="role-desc" className="text-xs font-semibold">
                    Role Duties & Description
                  </Label>
                  <textarea
                    id="role-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what the volunteer will be doing during this shift..."
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRoleForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isPending ? 'Creating...' : 'Save Role'}
                </Button>
              </div>
            </form>
          )}

          {/* Existing Roles List */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => {
              const spotsLeft = r.available_spots ?? (r.capacity - (r.signup_count ?? 0))
              return (
                <div
                  key={r.id}
                  className="flex flex-col justify-between rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-sm text-[--text-primary]">{r.title}</h4>
                      <Badge variant="outline" className="text-[10px]">
                        {spotsLeft} / {r.capacity} spots open
                      </Badge>
                    </div>

                    {r.description && (
                      <p className="mt-2 text-xs text-[--text-secondary] line-clamp-2">
                        {r.description}
                      </p>
                    )}

                    <div className="mt-3 space-y-1 text-xs text-[--text-muted]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span>
                          {r.shift_start
                            ? new Date(r.shift_start).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : 'Flexible'}
                        </span>
                      </div>

                      {r.required_skills && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {r.required_skills
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((skill: string, idx: number) => (
                              <span
                                key={idx}
                                className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              >
                                {skill}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="mt-4 pt-3 border-t border-[--border-subtle] flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRole(r.id, r.title)}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Role
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
