'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraduationCap,
  Plus,
  Globe,
  Users,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  adminCreateCampus,
  adminUpdateCampus,
  adminAddDomain,
  adminRemoveDomain,
  adminApproveCampusException,
} from '@/app/actions/admin.actions'
import type { AdminCampusWithCounts, AdminCampusException } from '@/types'

interface CampusManagementClientProps {
  initialCampuses: AdminCampusWithCounts[]
  initialExceptions: AdminCampusException[]
}

export function CampusManagementClient({
  initialCampuses,
  initialExceptions,
}: CampusManagementClientProps) {
  const router = useRouter()
  const [campuses, setCampuses] = useState<AdminCampusWithCounts[]>(initialCampuses)
  const [exceptions, setExceptions] = useState<AdminCampusException[]>(initialExceptions)
  const [activeSection, setActiveSection] = useState<'campuses' | 'exceptions'>('campuses')

  // Create Campus modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCampusName, setNewCampusName] = useState('')
  const [newCampusSlug, setNewCampusSlug] = useState('')
  const [newCampusDomains, setNewCampusDomains] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add Domain state per campus
  const [domainInputs, setDomainInputs] = useState<Record<string, string>>({})
  const [addingDomainId, setAddingDomainId] = useState<string | null>(null)
  const [removingDomain, setRemovingDomain] = useState<{ campusId: string; domain: string } | null>(null)

  // Exception review state
  const [reviewingException, setReviewingException] = useState<AdminCampusException | null>(null)
  const [exceptionNotes, setExceptionNotes] = useState('')
  const [exceptionLoading, setExceptionLoading] = useState(false)

  // Auto-slug generator
  function handleNameChange(name: string) {
    setNewCampusName(name)
    setNewCampusSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    )
  }

  // Handle Create Campus
  async function handleCreateCampus(e: React.FormEvent) {
    e.preventDefault()
    if (!newCampusName.trim() || !newCampusSlug.trim()) {
      toast.error('Campus name and slug are required')
      return
    }

    const parsedDomains = newCampusDomains
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)

    setIsSubmitting(true)
    try {
      const result = await adminCreateCampus({
        name: newCampusName.trim(),
        slug: newCampusSlug.trim(),
        approved_domains: parsedDomains,
      })

      if (result.success && result.data) {
        toast.success(`Created campus ${newCampusName.trim()}`)
        setCampuses((prev) => [
          ...prev,
          {
            id: result.data!.id,
            name: newCampusName.trim(),
            slug: newCampusSlug.trim(),
            approved_domains: parsedDomains,
            is_active: true,
            verified_user_count: 0,
            total_user_count: 0,
            event_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        setShowCreateModal(false)
        setNewCampusName('')
        setNewCampusSlug('')
        setNewCampusDomains('')
        router.refresh()
      } else {
        toast.error('Failed to create campus', { description: !result.success ? result.error : undefined })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle active status
  async function handleToggleActive(campus: AdminCampusWithCounts) {
    const newStatus = !campus.is_active
    const result = await adminUpdateCampus(campus.id, { is_active: newStatus })

    if (result.success) {
      toast.success(`${campus.name} is now ${newStatus ? 'active' : 'inactive'}`)
      setCampuses((prev) =>
        prev.map((c) => (c.id === campus.id ? { ...c, is_active: newStatus } : c))
      )
      router.refresh()
    } else {
      toast.error('Failed to update campus status', { description: !result.success ? result.error : undefined })
    }
  }

  // Add Domain to campus
  async function handleAddDomain(campusId: string) {
    const domain = (domainInputs[campusId] || '').trim().toLowerCase()
    if (!domain) {
      toast.error('Domain cannot be empty')
      return
    }

    setAddingDomainId(campusId)
    try {
      const result = await adminAddDomain(campusId, domain)
      if (result.success) {
        toast.success(`Added @${domain}`)
        setCampuses((prev) =>
          prev.map((c) =>
            c.id === campusId
              ? { ...c, approved_domains: [...(c.approved_domains || []), domain] }
              : c
          )
        )
        setDomainInputs((prev) => ({ ...prev, [campusId]: '' }))
        router.refresh()
      } else {
        toast.error('Failed to add domain', { description: !result.success ? result.error : undefined })
      }
    } finally {
      setAddingDomainId(null)
    }
  }

  // Remove Domain from campus
  async function handleConfirmRemoveDomain() {
    if (!removingDomain) return
    const { campusId, domain } = removingDomain

    try {
      const result = await adminRemoveDomain(campusId, domain)
      if (result.success) {
        toast.success(`Removed @${domain}`)
        setCampuses((prev) =>
          prev.map((c) =>
            c.id === campusId
              ? {
                  ...c,
                  approved_domains: (c.approved_domains || []).filter(
                    (d) => d.toLowerCase() !== domain.toLowerCase()
                  ),
                }
              : c
          )
        )
        setRemovingDomain(null)
        router.refresh()
      } else {
        toast.error('Failed to remove domain', { description: !result.success ? result.error : undefined })
      }
    } catch {
      toast.error('Unexpected error removing domain')
    }
  }

  // Approve Campus Exception
  async function handleApproveException() {
    if (!reviewingException || !reviewingException.pending_campus_id) return
    setExceptionLoading(true)

    try {
      const result = await adminApproveCampusException(
        reviewingException.user_id
      )

      if (result.success) {
        toast.success(`Approved exception for ${reviewingException.full_name}`)
        setExceptions((prev) => prev.filter((e) => e.user_id !== reviewingException.user_id))
        setReviewingException(null)
        setExceptionNotes('')
        router.refresh()
      } else {
        toast.error('Failed to approve exception', { description: result.error })
      }
    } finally {
      setExceptionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
            Colleges & Universities
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Configure verified institutions, authorized email domains, and review student verification exceptions.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 self-start rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Institution
        </button>
      </div>

      {/* Tabs: Campuses vs Exceptions */}
      <div className="flex rounded-lg border border-[--border-subtle] bg-[--bg-surface] p-1 w-fit">
        <button
          onClick={() => setActiveSection('campuses')}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeSection === 'campuses'
              ? 'bg-[--bg-muted] text-[--text-primary] shadow-xs'
              : 'text-[--text-muted] hover:text-[--text-primary]'
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          Institutions ({campuses.length})
        </button>
        <button
          onClick={() => setActiveSection('exceptions')}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeSection === 'exceptions'
              ? 'bg-[--bg-muted] text-[--text-primary] shadow-xs'
              : 'text-[--text-muted] hover:text-[--text-primary]'
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          Exceptions Queue ({exceptions.length})
        </button>
      </div>

      {/* SECTION 1: Campuses List */}
      {activeSection === 'campuses' && (
        <div className="space-y-4">
          {campuses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--border-subtle] bg-[--bg-surface] p-12 text-center">
              <GraduationCap className="h-10 w-10 text-[--text-muted]" />
              <h3 className="mt-3 text-sm font-semibold text-[--text-primary]">No campuses yet</h3>
              <p className="mt-1 text-xs text-[--text-muted]">
                Add the first college or university to begin configuring email domains.
              </p>
            </div>
          ) : (
            campuses.map((campus) => (
              <div
                key={campus.id}
                className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-xs"
              >
                {/* Top row: Title, status, stats */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-[--text-primary]">{campus.name}</h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            campus.is_active
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {campus.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-[--text-muted]">slug: /{campus.slug}</p>
                    </div>
                  </div>

                  {/* Stats & Actions */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[--text-secondary]">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[--text-muted]" />
                      <strong>{campus.verified_user_count}</strong> verified (
                      {campus.total_user_count} total)
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[--text-muted]" />
                      <strong>{campus.event_count}</strong> events
                    </span>

                    <button
                      onClick={() => handleToggleActive(campus)}
                      title={campus.is_active ? 'Deactivate institution' : 'Activate institution'}
                      className="flex items-center gap-1 rounded-md border border-[--border-subtle] px-2.5 py-1 text-xs font-medium text-[--text-secondary] transition-colors hover:bg-[--bg-muted]"
                    >
                      {campus.is_active ? (
                        <>
                          <ToggleRight className="h-4 w-4 text-emerald-600" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-4 w-4 text-[--text-muted]" />
                          Activate
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Approved Domains section */}
                <div className="mt-4 border-t border-[--border-subtle] pt-4">
                  <p className="text-xs font-medium text-[--text-secondary]">
                    Approved Email Domains ({campus.approved_domains?.length || 0})
                  </p>
                  <p className="mt-0.5 text-[11px] text-[--text-muted]">
                    Students signing up with an email matching these domains are automatically verified for this campus.
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {campus.approved_domains && campus.approved_domains.length > 0 ? (
                      campus.approved_domains.map((dom) => (
                        <span
                          key={dom}
                          className="group inline-flex items-center gap-1.5 rounded-lg border border-[--border-subtle] bg-[--bg-base] px-2.5 py-1 text-xs font-medium text-[--text-primary]"
                        >
                          <Globe className="h-3 w-3 text-amber-600" />
                          @{dom}
                          <button
                            onClick={() =>
                              setRemovingDomain({ campusId: campus.id, domain: dom })
                            }
                            className="text-[--text-muted] opacity-70 transition-opacity hover:text-red-600 hover:opacity-100"
                            title={`Remove @${dom}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs italic text-[--text-muted]">
                        No approved domains configured yet.
                      </span>
                    )}

                    {/* Add Domain inline form */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. stanford.edu"
                        value={domainInputs[campus.id] || ''}
                        onChange={(e) =>
                          setDomainInputs((prev) => ({
                            ...prev,
                            [campus.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddDomain(campus.id)
                          }
                        }}
                        className="rounded-lg border border-[--border-subtle] bg-[--bg-base] px-2.5 py-1 text-xs text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleAddDomain(campus.id)}
                        disabled={addingDomainId === campus.id}
                        className="flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                      >
                        {addingDomainId === campus.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        Add Domain
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SECTION 2: Exceptions Queue */}
      {activeSection === 'exceptions' && (
        <div className="space-y-4">
          {exceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--border-subtle] bg-[--bg-surface] p-12 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
              <h3 className="mt-3 text-sm font-semibold text-[--text-primary]">
                All exceptions resolved
              </h3>
              <p className="mt-1 text-xs text-[--text-muted]">
                There are no pending campus verification exception requests from students.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[--border-subtle] bg-[--bg-surface]">
              <div className="divide-y divide-[--border-subtle]">
                {exceptions.map((ex) => (
                  <div
                    key={ex.user_id}
                    className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[--text-primary]">{ex.full_name}</span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          Pending Review
                        </span>
                      </div>
                      <p className="text-xs text-[--text-muted]">{ex.email}</p>

                      <div className="mt-2 text-xs text-[--text-secondary]">
                        Requested Campus:{' '}
                        <strong className="text-[--text-primary]">
                          {ex.pending_campus_name || 'Unknown'}
                        </strong>
                      </div>

                      {ex.exception_reason && (
                        <p className="mt-1.5 rounded-lg bg-[--bg-base] p-2 text-xs text-[--text-secondary]">
                          <span className="font-medium text-[--text-primary]">Student Note:</span>{' '}
                          {ex.exception_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      <button
                        onClick={() => setReviewingException(ex)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Approve Exception
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Campus */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[--text-primary]">
              Add Institution
            </h3>
            <p className="mt-1 text-xs text-[--text-secondary]">
              Register a college or university for campus-restricted event discovery and organizer verification.
            </p>

            <form onSubmit={handleCreateCampus} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[--text-secondary]">
                  Institution Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stanford University"
                  value={newCampusName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[--border-subtle] bg-[--bg-base] p-2.5 text-sm text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[--text-secondary]">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. stanford"
                  value={newCampusSlug}
                  onChange={(e) => setNewCampusSlug(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[--border-subtle] bg-[--bg-base] p-2.5 text-sm text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[--text-secondary]">
                  Approved Email Domains (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="stanford.edu, alumni.stanford.edu"
                  value={newCampusDomains}
                  onChange={(e) => setNewCampusDomains(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[--border-subtle] bg-[--bg-base] p-2.5 text-sm text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <p className="mt-1 text-[11px] text-[--text-muted]">
                  Do not include the &quot;@&quot; symbol. Example: stanford.edu
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-[--border-subtle] px-4 py-2 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Institution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Remove Domain */}
      {removingDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-xl">
            <h3 className="font-display text-base font-bold text-[--text-primary]">
              Remove Approved Domain?
            </h3>
            <p className="mt-2 text-xs text-[--text-secondary]">
              Are you sure you want to remove <strong className="text-[--text-primary]">@{removingDomain.domain}</strong>?
              New students using this domain will no longer be automatically verified for this institution.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemovingDomain(null)}
                className="rounded-lg border border-[--border-subtle] px-3 py-1.5 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveDomain}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Remove Domain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Approve Exception */}
      {reviewingException && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-xl">
            <h3 className="font-display text-base font-bold text-[--text-primary]">
              Approve Campus Verification Exception
            </h3>
            <p className="mt-2 text-xs text-[--text-secondary]">
              Verify <strong className="text-[--text-primary]">{reviewingException.full_name}</strong> ({reviewingException.email}) for{' '}
              <strong className="text-[--text-primary]">{reviewingException.pending_campus_name}</strong>?
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-[--text-secondary]">
                Admin Notes (recorded in audit log)
              </label>
              <textarea
                value={exceptionNotes}
                onChange={(e) => setExceptionNotes(e.target.value)}
                placeholder="e.g. Verified student ID card via email submission."
                rows={3}
                className="mt-1 w-full rounded-lg border border-[--border-subtle] bg-[--bg-base] p-2.5 text-sm text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReviewingException(null)}
                disabled={exceptionLoading}
                className="rounded-lg border border-[--border-subtle] px-3 py-1.5 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveException}
                disabled={exceptionLoading}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {exceptionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
