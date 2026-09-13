import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CampusOnboardingModal } from '@/components/campus/CampusOnboardingModal'
import { APP_NAME } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/auth/admin'
import type { Campus } from '@/types'

export const metadata: Metadata = {
  title: `Dashboard — ${APP_NAME}`,
}

export const dynamic = 'force-dynamic'

interface AppLayoutProps {
  children: React.ReactNode
}

/**
 * Authenticated application layout.
 * Server-side auth check is handled by middleware.ts.
 * This layout adds the Navbar and Footer and marks main with id="main-content".
 */
export default async function AppLayout({ children }: AppLayoutProps) {
  let user = null
  let isOrganizer = false
  let isAdmin = false
  let currentCampus: Campus | null = null
  let campuses: Campus[] = []

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user

    const { data: campusData } = await supabase
      .from('campuses')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    campuses = (campusData || []) as unknown as Campus[]

    if (user) {
      try {
        isAdmin = await isSystemAdmin(supabase, user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, campus_id')
          .eq('id', user.id)
          .maybeSingle()

        isOrganizer = profile?.role === 'organizer' || user.user_metadata?.['role'] === 'organizer'
        const campusId = (profile as { campus_id?: string | null })?.campus_id || user.user_metadata?.['campus_id']
        if (campusId) {
          currentCampus = campuses.find((c) => c.id === campusId) || null
        }
      } catch {
        // Safe fallback
      }
    }
  } catch (error) {
    console.error('Failed to get user in AppLayout:', error)
  }

  const showOnboarding = !!user && !currentCampus && campuses.length > 0

  return (
    <>
      <Navbar
        user={user}
        isOrganizer={isOrganizer}
        isAdmin={isAdmin}
        currentCampus={currentCampus}
        campuses={campuses}
      />
      {showOnboarding && (
        <CampusOnboardingModal campuses={campuses} userEmail={user?.email} />
      )}
      <main id="main-content" className="flex flex-1 flex-col bg-[--bg-base]">
        {children}
      </main>
      <Footer />
    </>
  )
}
