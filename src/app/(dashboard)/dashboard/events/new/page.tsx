import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, ShieldAlert, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EventForm } from '@/components/dashboard/EventForm'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_verified, campus_id, campus_verification_status')
    .eq('id', user.id)
    .maybeSingle()

  let isCampusVerified = profile?.campus_verification_status === 'verified'
  if (!isCampusVerified && profile?.campus_id && user.email) {
    const { data: campus } = await supabase
      .from('campuses')
      .select('approved_domains')
      .eq('id', profile.campus_id)
      .maybeSingle()
    const domain = user.email.split('@')[1]?.toLowerCase()
    if (domain && campus?.approved_domains?.map((d: string) => d.toLowerCase()).includes(domain)) {
      await supabase
        .from('profiles')
        .update({
          campus_verification_status: 'verified',
          campus_verified_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      isCampusVerified = true
    }
  }

  const isVerifiedOrganizer =
    profile?.role === 'organizer' &&
    Boolean(profile?.is_verified) &&
    isCampusVerified

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary]">Create Event</h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Fill in the details below to create a new campus event.
          </p>
        </div>
        <Link
          href="/dashboard/events"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </Link>
      </div>

      {!isVerifiedOrganizer ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 dark:border-amber-900/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-sm max-w-2xl">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold">Verified Campus Organizer Required</h2>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                To create and publish campus events, your club or organization account must be fully verified and associated with an authenticated university campus.
              </p>

              <div className="mt-4 space-y-2 text-xs text-amber-800 dark:text-amber-200">
                {profile?.campus_verification_status === 'unverified' && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span>Your campus email address is not yet verified. Check your inbox or update your settings.</span>
                  </div>
                )}
                {profile?.campus_verification_status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span>Your campus affiliation exception is currently awaiting administrative approval.</span>
                  </div>
                )}
                {profile?.role === 'organizer' && !profile?.is_verified && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span>Your organizer status is pending review by campus administrators.</span>
                  </div>
                )}
                {profile?.role !== 'organizer' && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span>You are currently registered as a student. To host events, request organizer status.</span>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <Link
                  href="/settings"
                  className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
                >
                  Go to Campus Settings
                </Link>
                <Link
                  href="/dashboard/events"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  Return to Events
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 sm:p-8">
          <EventForm mode="create" />
        </div>
      )}
    </div>
  )
}

