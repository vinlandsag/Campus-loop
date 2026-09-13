'use client'

import { useState, useTransition } from 'react'
import {
  User,
  Sparkles,
  Globe,
  Instagram,
  Mail,
  Building,
  GraduationCap,
  Shield,
  Check,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { updateUserProfile } from '@/app/actions/settings.actions'
import type { Profile, PublicFieldsVisibility } from '@/types'

interface ProfileTabProps {
  profile: Profile
  onDirtyChange?: (isDirty: boolean) => void
}

const DEFAULT_VISIBILITY: PublicFieldsVisibility = {
  bio: true,
  website: true,
  instagram: true,
  contact_email: true,
  college: true,
  department: true,
}

export function ProfileTab({ profile, onDirtyChange }: ProfileTabProps) {
  const isOrganizer = profile.role === 'organizer'

  // Form State
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [preferredName, setPreferredName] = useState(profile.preferred_name || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [college, setCollege] = useState(profile.college || '')
  const [department, setDepartment] = useState(profile.department || '')
  const [year, setYear] = useState(profile.year || '')

  // Organizer presentation fields
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || '')
  const [instagramHandle, setInstagramHandle] = useState(profile.instagram_handle || '')
  const [contactEmail, setContactEmail] = useState(profile.contact_email || '')

  // Field visibility toggles for organizer public profile
  const [visibility, setVisibility] = useState<PublicFieldsVisibility>({
    ...DEFAULT_VISIBILITY,
    ...(profile.public_fields_visibility || {}),
  })

  const [isPending, startTransition] = useTransition()
  const [savedSuccess, setSavedSuccess] = useState(false)

  const toggleVisibility = (key: keyof PublicFieldsVisibility) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      onDirtyChange?.(true)
      return next
    })
  }

  const handleInputChange = (setter: (val: string) => void) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setter(e.target.value)
    onDirtyChange?.(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName.trim()) {
      toast.error('Full name is required.')
      return
    }

    startTransition(async () => {
      const res = await updateUserProfile({
        full_name: fullName.trim(),
        preferred_name: preferredName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        bio: bio.trim() || null,
        college: college.trim() || null,
        department: department.trim() || null,
        year: year.trim() || null,
        website_url: isOrganizer ? websiteUrl.trim() || null : undefined,
        instagram_handle: isOrganizer ? instagramHandle.trim() || null : undefined,
        contact_email: isOrganizer ? contactEmail.trim() || null : undefined,
        public_fields_visibility: isOrganizer ? visibility : undefined,
      })

      if (res.success) {
        setSavedSuccess(true)
        onDirtyChange?.(false)
        toast.success('Profile updated successfully!')
        setTimeout(() => setSavedSuccess(false), 3000)
      } else {
        toast.error(res.error || 'Failed to update profile.')
      }
    })
  }

  const displayName = preferredName.trim() ? `${preferredName.trim()} (${fullName})` : fullName

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div>
        <h2 className="font-display text-xl font-bold text-[--text-primary]">
          Profile & Identity
        </h2>
        <p className="mt-1 text-xs text-[--text-secondary]">
          Manage how you appear to organizers, classmates, and attendees across campus.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Account Details */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600" />
            Personal Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="text-xs">
                Full Legal / Academic Name *
              </Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={handleInputChange(setFullName)}
                placeholder="e.g. Maya Chen"
                required
                className="text-xs"
              />
              <p className="text-[11px] text-[--text-muted]">Used on formal certificates and official rosters.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="preferred_name" className="text-xs">
                Preferred Display Name (Optional)
              </Label>
              <Input
                id="preferred_name"
                value={preferredName}
                onChange={handleInputChange(setPreferredName)}
                placeholder="e.g. Maya"
                className="text-xs"
              />
              <p className="text-[11px] text-[--text-muted]">Shown in casual feeds and event chats.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="avatar_url" className="text-xs">
              Avatar Image URL
            </Label>
            <Input
              id="avatar_url"
              type="url"
              value={avatarUrl}
              onChange={handleInputChange(setAvatarUrl)}
              placeholder="https://..."
              className="text-xs"
            />
            <p className="text-[11px] text-[--text-muted]">
              Direct image link to your profile picture (Square aspect ratio recommended).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio" className="text-xs">
              Bio / About
            </Label>
            <textarea
              id="bio"
              rows={3}
              value={bio}
              onChange={handleInputChange(setBio)}
              placeholder="Share a short summary of your background, academic interests, or club mission..."
              className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-3 text-xs text-[--text-primary] focus:border-[--primary] focus:outline-none focus:ring-1 focus:ring-[--primary]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="college" className="text-xs">
                College / School
              </Label>
              <Input
                id="college"
                value={college}
                onChange={handleInputChange(setCollege)}
                placeholder="e.g. School of Engineering"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="department" className="text-xs">
                Department / Major
              </Label>
              <Input
                id="department"
                value={department}
                onChange={handleInputChange(setDepartment)}
                placeholder="e.g. Computer Science"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="year" className="text-xs">
                Class / Graduation Year
              </Label>
              <select
                id="year"
                value={year}
                onChange={handleInputChange(setYear)}
                className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2 text-xs text-[--text-primary] focus:border-[--primary] focus:outline-none"
              >
                <option value="">Select Year...</option>
                <option value="First Year">First Year (Freshman)</option>
                <option value="Second Year">Second Year (Sophomore)</option>
                <option value="Third Year">Third Year (Junior)</option>
                <option value="Fourth Year">Fourth Year (Senior)</option>
                <option value="Graduate">Graduate / Masters</option>
                <option value="PhD / Faculty">PhD / Faculty / Staff</option>
                <option value="Alumni">Alumni</option>
              </select>
            </div>
          </div>
        </div>

        {/* Organizer Public Fields & Visibility Toggles */}
        {isOrganizer && (
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20 p-5 sm:p-6 space-y-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  Public Club / Organizer Presentation
                </h3>
                <p className="text-xs text-[--text-secondary] mt-0.5">
                  Configure public contact channels and control which fields are visible on your public club page.
                </p>
              </div>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Verified Organizer
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="website" className="text-xs flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Website URL
                  </Label>
                  <button
                    type="button"
                    onClick={() => toggleVisibility('website')}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    {visibility.website ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {visibility.website ? 'Public' : 'Hidden'}
                  </button>
                </div>
                <Input
                  id="website"
                  type="url"
                  value={websiteUrl}
                  onChange={handleInputChange(setWebsiteUrl)}
                  placeholder="https://acm-campus.org"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="instagram" className="text-xs flex items-center gap-1">
                    <Instagram className="h-3 w-3" /> Instagram
                  </Label>
                  <button
                    type="button"
                    onClick={() => toggleVisibility('instagram')}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    {visibility.instagram ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {visibility.instagram ? 'Public' : 'Hidden'}
                  </button>
                </div>
                <Input
                  id="instagram"
                  value={instagramHandle}
                  onChange={handleInputChange(setInstagramHandle)}
                  placeholder="@campus_acm"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="contact_email" className="text-xs flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Contact Email
                  </Label>
                  <button
                    type="button"
                    onClick={() => toggleVisibility('contact_email')}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    {visibility.contact_email ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {visibility.contact_email ? 'Public' : 'Hidden'}
                  </button>
                </div>
                <Input
                  id="contact_email"
                  type="email"
                  value={contactEmail}
                  onChange={handleInputChange(setContactEmail)}
                  placeholder="contact@club.edu"
                  className="text-xs"
                />
              </div>
            </div>

            {/* Field Visibility Toggles Table */}
            <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4 space-y-3">
              <p className="text-xs font-semibold text-[--text-primary]">
                Public Directory Field Toggles
              </p>
              <p className="text-[11px] text-[--text-muted]">
                Unchecked fields are strictly masked at the database level and will never appear on your public organizer profile.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {(['bio', 'website', 'instagram', 'contact_email', 'college', 'department'] as const).map(
                  (field) => (
                    <label
                      key={field}
                      className="flex items-center gap-2 text-xs text-[--text-secondary] cursor-pointer rounded-lg border border-[--border-subtle] p-2 hover:bg-[--bg-muted]/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={visibility[field]}
                        onChange={() => toggleVisibility(field)}
                        className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                      />
                      <span className="capitalize">{field.replace('_', ' ')}</span>
                    </label>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Non-Editable Roles Security Notice */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[--text-primary] flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-zinc-500" />
              Institutional Role & Status
            </span>
            <Badge variant="outline" className="capitalize text-xs">
              {profile.role}
            </Badge>
          </div>
          <div className="flex items-start gap-2 text-xs text-[--text-muted] leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-zinc-400" />
            <p>
              Account roles, admin privileges, and official club verification cannot be self-modified for integrity reasons. To upgrade your organization status, contact campus event services.
            </p>
          </div>
        </div>

        {/* Live Public Profile Preview Card */}
        <div className="rounded-2xl border border-[--border-subtle] bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900/50 dark:to-zinc-900/20 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
              Live Public Profile Preview
            </span>
            <span className="text-[11px] text-[--text-muted]">How attendees and clubs see you</span>
          </div>

          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                fullName.slice(0, 2).toUpperCase()
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-[--text-primary] truncate">{displayName}</h4>
                {isOrganizer && profile.is_verified && (
                  <Badge variant="default" className="bg-emerald-600 text-white text-[10px] h-4 py-0">
                    Verified
                  </Badge>
                )}
              </div>

              {bio && (!isOrganizer || visibility.bio) && (
                <p className="text-xs text-[--text-secondary] line-clamp-2">{bio}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {college && (!isOrganizer || visibility.college) && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[--text-muted]">
                    <Building className="h-3 w-3" /> {college}
                  </span>
                )}
                {department && (!isOrganizer || visibility.department) && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[--text-muted]">
                    <GraduationCap className="h-3 w-3" /> {department}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Changes saved successfully!
            </span>
          )}
          {!savedSuccess && <span />}

          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Profile Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
