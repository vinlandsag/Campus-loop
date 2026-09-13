'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Camera,
  Plus,
  Trash2,
  ExternalLink,
  Shield,
  AlertCircle,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  uploadEventPhoto,
  deleteEventPhoto,
} from '@/app/actions/gallery.actions'
import type { EventPhoto } from '@/types'

interface GalleryManagementClientProps {
  eventId: string
  eventTitle: string
  eventSlug: string
  initialPhotos: EventPhoto[]
}

export function GalleryManagementClient({
  eventId,
  eventTitle,
  eventSlug,
  initialPhotos,
}: GalleryManagementClientProps) {
  const [photos, setPhotos] = useState<EventPhoto[]>(initialPhotos)
  const [showForm, setShowForm] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [photographerCredit, setPhotographerCredit] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!photoUrl.trim() || !photoUrl.startsWith('http')) {
      setError('Please provide a valid image URL starting with http/https.')
      return
    }

    startTransition(async () => {
      const res = await uploadEventPhoto(
        eventId,
        photoUrl.trim(),
        caption.trim() || undefined
      )

      if (res.success && res.data) {
        toast.success('Curated photo added to event gallery!')
        setPhotos((prev) => [res.data!, ...prev])
        setPhotoUrl('')
        setCaption('')
        setPhotographerCredit('')
        setShowForm(false)
      } else {
        const errorMsg = !res.success ? res.error : 'Failed to add photo.'
        setError(errorMsg || 'Failed to add photo.')
      }
    })
  }

  const handleDeletePhoto = (photoId: string) => {
    if (!confirm('Are you sure you want to remove this photo from the gallery?')) return

    startTransition(async () => {
      const res = await deleteEventPhoto(photoId, eventId)
      if (res.success) {
        toast.success('Photo removed from gallery.')
        setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      } else {
        toast.error(res.error || 'Failed to delete photo.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Public Link & Add Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-bold text-[--text-primary]">
              Curated Highlights & Photos: {eventTitle}
            </h2>
          </div>
          <p className="text-xs text-[--text-secondary] mt-1">
            Organizers maintain full curation over published highlights for this event. Public attendee uploads are disabled to prevent spam and privacy violations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/events/${eventSlug}/gallery`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-muted] px-3.5 py-2 text-xs font-semibold text-[--text-primary] hover:bg-[--border-subtle] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Public Gallery
          </Link>

          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {showForm ? 'Cancel' : 'Add Photo'}
          </Button>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <Shield className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
        <p className="text-indigo-900 dark:text-indigo-200">
          <strong>Attendee Privacy Protection:</strong> Attendees can request removal or opt out of photo appearances. Any reported photos will be flagged to campus moderators and organizers.
        </p>
      </div>

      {/* Add Photo Form */}
      {showForm && (
        <form
          onSubmit={handleAddPhoto}
          className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm space-y-4"
        >
          <h3 className="font-bold text-sm text-[--text-primary]">Add Curated Highlight</h3>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
            <div className="sm:col-span-12">
              <Label htmlFor="photo-url" className="text-xs font-semibold">
                Photo URL (Image Address)
              </Label>
              <Input
                id="photo-url"
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... or Supabase storage URL"
                required
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div className="sm:col-span-8">
              <Label htmlFor="photo-caption" className="text-xs font-semibold">
                Caption / Description (Optional)
              </Label>
              <Input
                id="photo-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Winners receiving trophies on main stage"
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-4">
              <Label htmlFor="photo-credit" className="text-xs font-semibold">
                Photographer Credit (Optional)
              </Label>
              <Input
                id="photo-credit"
                value={photographerCredit}
                onChange={(e) => setPhotographerCredit(e.target.value)}
                placeholder="e.g. Media Club / Sarah Jenkins"
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {isPending ? 'Publishing...' : 'Publish to Gallery'}
            </Button>
          </div>
        </form>
      )}

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[--border-subtle] bg-[--bg-surface] p-12 text-center shadow-sm">
          <Camera className="h-10 w-10 mx-auto text-[--text-muted] opacity-40 mb-3" />
          <h3 className="font-bold text-sm text-[--text-primary]">No Photos Added Yet</h3>
          <p className="mt-1 text-xs text-[--text-secondary] max-w-sm mx-auto">
            Upload post-event highlights and memorable moments for attendees to view and celebrate.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">
                <Image
                  src={photo.photo_url}
                  alt={photo.caption || 'Event highlight'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>

              <div className="p-4 flex flex-col justify-between flex-1">
                <div>
                  <p className="text-xs font-medium text-[--text-primary]">
                    {photo.caption || <span className="italic text-[--text-muted]">No caption</span>}
                  </p>
                  {photo.photographer_credit && (
                    <p className="text-[11px] text-[--text-muted] mt-1">
                      Credit: {photo.photographer_credit}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[--border-subtle] flex items-center justify-between">
                  <span className="text-[10px] text-[--text-muted]">
                    {new Date(photo.created_at).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
