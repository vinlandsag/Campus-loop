import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Camera, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEventPhotos } from '@/app/actions/gallery.actions'
import { ReportButton } from '@/components/moderation/ReportButton'
import { SectionContainer } from '@/components/shared/SectionContainer'

interface GalleryPageProps {
  params: Promise<{ slug: string }>
}

export default async function EventGalleryPage({ params }: GalleryPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // 1. Fetch event
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title, slug, event_date')
    .eq('slug', slug)
    .single()

  if (eventErr || !event) {
    notFound()
  }

  // 2. Fetch curated photos
  const photosRes = await getEventPhotos(event.id)
  const photos = photosRes.success ? (photosRes.data || []) : []

  return (
    <div className="min-h-screen pb-20">
      <SectionContainer className="pt-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/events/${slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-[--text-secondary] transition-colors hover:text-[--text-primary]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Event Details
          </Link>
          <Link
            href={`/events/${slug}/live`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[--border-subtle] bg-[--bg-surface] px-3 py-1 text-xs font-medium text-[--text-secondary] hover:bg-[--bg-muted] transition-colors"
          >
            Live Updates Board →
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <Camera className="h-3.5 w-3.5" />
              Event Gallery
            </span>
            <span className="text-xs text-[--text-muted]">
              {photos.length} {photos.length === 1 ? 'Curated Photo' : 'Curated Photos'}
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[--text-primary] sm:text-4xl">
            {event.title}
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Official moments and highlights curated by the event organizers.
          </p>
        </div>

        {/* Student Privacy & Opt-Out Notice */}
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <Shield className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-indigo-950 dark:text-indigo-200">
              Student Privacy & Appearance Rights
            </p>
            <p className="text-indigo-800/90 dark:text-indigo-300">
              Only verified event organizers and coordinators may publish photos here. If you appear in a photo and prefer not to be shown, you can report it directly for immediate organizer review, or configure your photo appearance preferences in{' '}
              <Link href="/settings" className="font-semibold underline hover:text-indigo-900 dark:hover:text-indigo-100">
                Account Settings
              </Link>.
            </p>
          </div>
        </div>

        {/* Photo Grid or Empty State */}
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[--border-subtle] bg-[--bg-surface] py-16 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[--bg-muted] text-[--text-muted]">
              <Camera className="h-8 w-8" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-[--text-primary]">
              No Highlights Posted Yet
            </h3>
            <p className="mt-1 max-w-sm text-xs text-[--text-secondary]">
              Organizers will post curated event photos and highlights here during and following the event.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm transition-all hover:shadow-md hover:border-[--border-strong]"
              >
                {/* Photo image container */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">
                  <Image
                    src={photo.photo_url}
                    alt={photo.caption || `Highlight from ${event.title}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {/* Subtle gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  
                  {/* Report Button overlay */}
                  <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <ReportButton
                      targetType="photo"
                      targetId={photo.id}
                      targetTitle={`Photo from ${event.title}`}
                      variant="secondary"
                      size="sm"
                      className="bg-black/70 text-white hover:bg-rose-600 border-0 backdrop-blur-sm shadow-sm"
                    />
                  </div>
                </div>

                {/* Caption & Metadata */}
                <div className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    {photo.caption ? (
                      <p className="text-sm font-medium text-[--text-primary] leading-relaxed">
                        {photo.caption}
                      </p>
                    ) : (
                      <p className="text-xs italic text-[--text-muted]">Event highlight</p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-[--border-subtle] pt-3 text-[11px] text-[--text-muted]">
                    <span>
                      {photo.photographer_credit ? `By ${photo.photographer_credit}` : 'Official Media'}
                    </span>
                    <span>
                      {new Date(photo.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionContainer>
    </div>
  )
}
