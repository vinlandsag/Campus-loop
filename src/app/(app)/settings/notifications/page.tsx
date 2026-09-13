import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { getUserNotificationPreferences } from '@/lib/notifications/preferences'
import { NotificationPreferencesForm } from '@/components/settings/NotificationPreferencesForm'

export default async function NotificationPreferencesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const preferences = await getUserNotificationPreferences(user.id, supabase)

  return (
    <SectionContainer className="py-10 md:py-16">
      <div className="mb-8 md:mb-12">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[--text-secondary] transition-colors hover:text-[--text-primary] mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-[--text-primary] md:text-4xl">
              Notification Preferences
            </h1>
            <p className="mt-1 text-sm text-[--text-secondary]">
              Choose which event reminders, updates, and communications you want to receive.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <NotificationPreferencesForm initialPreferences={preferences} />
      </div>
    </SectionContainer>
  )
}
