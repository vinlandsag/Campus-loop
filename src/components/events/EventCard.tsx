import Link from 'next/link'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import { Calendar, Clock, MapPin, Users, CheckCircle2, GraduationCap } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { FavoriteButton } from '@/components/events/FavoriteButton'
import { FriendAttendanceBadge } from '@/components/social/FriendAttendanceBadge'
import { RecommendationExplanationModal } from '@/components/events/RecommendationExplanationModal'
import type { ConsentedFriendAttendance, RecommendationExplanation } from '@/types'

export interface EventCardProps {
  id: string
  title: string
  slug: string
  category: string
  event_date: string
  start_time: string
  location: string
  capacity: number | null
  banner_url: string | null
  organizer: {
    full_name: string
    avatar_url: string | null
    is_verified?: boolean
  }
  organizer_id?: string
  campus?: {
    id?: string
    name: string
    slug?: string
  } | null
  registrations_count: number
  isAuthenticated?: boolean
  isFavorited?: boolean
  registrationStatus?: 'registered' | 'waitlisted' | 'checked_in' | 'cancelled' | null
  waitlistPosition?: number | null
  is_paid?: boolean
  price?: number | null
  friendAttendance?: ConsentedFriendAttendance | null
  recommendationExplanation?: RecommendationExplanation | null
}

export function EventCard({
  id,
  title,
  slug,
  category,
  event_date,
  start_time,
  location,
  capacity,
  banner_url,
  organizer,
  organizer_id,
  campus,
  registrations_count,
  isAuthenticated = false,
  isFavorited = false,
  registrationStatus = null,
  waitlistPosition = null,
  is_paid = false,
  price = null,
  friendAttendance = null,
  recommendationExplanation = null,
}: EventCardProps) {
  // Compute date/time formatting safely
  let formattedDate = ''
  let formattedTime = ''
  try {
    const dateObj = parseISO(event_date)
    formattedDate = format(dateObj, 'MMM d, yyyy')

    // Simple time formatting assuming start_time is HH:MM:SS
    const [hours, minutes] = start_time.split(':')
    const timeDate = new Date()
    timeDate.setHours(parseInt(hours || '0', 10), parseInt(minutes || '0', 10))
    formattedTime = format(timeDate, 'h:mm a')
  } catch {
    formattedDate = event_date
    formattedTime = start_time
  }

  // Calculate spots left
  const spotsLeft = capacity !== null ? Math.max(0, capacity - registrations_count) : null
  const isFull = spotsLeft === 0
  const isOnline = /online|zoom|meet|virtual|remote|webinar/i.test(location)

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm transition-all hover:border-[--border-default] hover:shadow-md">
      {/* Banner */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[--bg-muted]">
        <Link href={`/events/${slug}`} className="block h-full w-full">
          {banner_url ? (
            <Image
              src={banner_url || ''}
              alt={title}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[--accent-100] to-[--accent-50]">
              <Calendar className="h-12 w-12 text-[--accent-200]" />
            </div>
          )}
        </Link>

        {/* Category Pill */}
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/95 dark:bg-zinc-900/90 px-3 py-1 text-xs font-semibold tracking-wide text-[--text-primary] shadow-sm backdrop-blur-md">
          {category}
        </div>

        {/* Status Cue Badge for Registered / Waitlisted / Attended */}
        {registrationStatus === 'registered' && (
          <div className="pointer-events-none absolute left-4 bottom-3 flex items-center gap-1.5 rounded-full bg-emerald-600/95 px-3 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-md">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Registered</span>
          </div>
        )}
        {registrationStatus === 'checked_in' && (
          <div className="pointer-events-none absolute left-4 bottom-3 flex items-center gap-1.5 rounded-full bg-blue-600/95 px-3 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-md">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Attended</span>
          </div>
        )}
        {registrationStatus === 'waitlisted' && (
          <div className="pointer-events-none absolute left-4 bottom-3 flex items-center gap-1.5 rounded-full bg-amber-600/95 px-3 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-md">
            <Clock className="h-3.5 w-3.5" />
            <span>Waitlist {waitlistPosition ? `#${waitlistPosition}` : 'Active'}</span>
          </div>
        )}

        {/* Favorite Button */}
        <div className="absolute right-4 top-4 z-10">
          <FavoriteButton
            eventId={id}
            slug={slug}
            isFavorited={isFavorited}
            isAuthenticated={isAuthenticated}
            variant="icon"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {campus ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[--accent-600] dark:text-[--accent-400]">
              <GraduationCap className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{campus.name}</span>
            </div>
          ) : <div />}
          {recommendationExplanation && (
            <RecommendationExplanationModal
              eventTitle={title}
              explanation={recommendationExplanation}
            />
          )}
        </div>

        <Link href={`/events/${slug}`} className="group-hover:underline">
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-tight text-[--text-primary]">
            {title}
          </h3>
        </Link>

        {/* Organizer / Club Link */}
        <div className="mt-1 flex items-center gap-1.5 text-sm text-[--text-secondary]">
          <span>by</span>
          {organizer_id ? (
            <Link
              href={`/organizers/${organizer_id}`}
              className="font-medium text-[--text-primary] hover:text-[--accent-600] hover:underline"
            >
              {organizer.full_name}
            </Link>
          ) : (
            <span className="font-medium text-[--text-primary]">{organizer.full_name}</span>
          )}
          {organizer.is_verified && (
            <span title="Verified Campus Club / Organizer" className="inline-flex items-center">
              <CheckCircle2
                className="h-4 w-4 text-blue-500 shrink-0 fill-blue-500/10"
                aria-label="Verified Organizer"
              />
            </span>
          )}
        </div>

        {/* Consented Friend Attendance Indicator */}
        {friendAttendance && friendAttendance.count > 0 && (
          <div className="mt-2.5">
            <FriendAttendanceBadge friendAttendance={friendAttendance} />
          </div>
        )}

        <div className="mt-5 flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-[--text-secondary]">
            <Calendar className="h-4 w-4 shrink-0 text-[--text-muted]" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[--text-secondary]">
            <Clock className="h-4 w-4 shrink-0 text-[--text-muted]" />
            <span>{formattedTime}</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-[--text-secondary]">
            <MapPin className="h-4 w-4 shrink-0 text-[--text-muted]" />
            <span className="line-clamp-2">{location}</span>
          </div>
        </div>

        {/* Footer/Capacity, Format & Price */}
        <div className="mt-6 border-t border-[--border-subtle] pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[--text-muted]" />
              <span className="text-sm font-medium text-[--text-primary]">
                {capacity === null ? (
                  'Unlimited spots'
                ) : isFull ? (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Waitlist open</span>
                ) : (
                  `${spotsLeft} spots left`
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-[--text-secondary]">
                {isOnline ? 'Online' : 'In-Person'}
              </span>
              <span className="inline-flex items-center rounded-full bg-[--bg-muted] px-2.5 py-0.5 text-xs font-semibold text-[--text-primary]">
                {is_paid && price !== null && price > 0 ? `₹${price}` : 'Free'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="flex flex-1 flex-col p-6">
        <Skeleton className="mb-2 h-3.5 w-1/4" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/3" />
        <div className="mt-5 flex flex-1 flex-col gap-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="mt-6 border-t border-[--border-subtle] pt-4">
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
    </div>
  )
}
