import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CampusOnboardingModal } from '@/components/campus/CampusOnboardingModal'
import { createClient } from '@/lib/supabase/server'
import type { Campus } from '@/types'

interface PublicLayoutProps {
  children: React.ReactNode
}

export const dynamic = 'force-dynamic'

/**
 * Public marketing layout.
 * Wraps unauthenticated and public pages with the shared Navbar and Footer.
 */
export default async function PublicLayout({ children }: PublicLayoutProps) {
  let user = null
  let isOrganizer = false
  let currentCampus: Campus | null = null
  let campuses: Campus[] = []

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user

    // Fetch active campuses
    const { data: campusData } = await supabase
      .from('campuses')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    campuses = (campusData || []) as unknown as Campus[]

    if (user) {
      try {
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
    console.error('Failed to get user/campuses in PublicLayout:', error)
  }

  const showOnboarding = !!user && !currentCampus && campuses.length > 0

  return (
    <>
      <Navbar
        user={user}
        isOrganizer={isOrganizer}
        currentCampus={currentCampus}
        campuses={campuses}
      />
      {showOnboarding && (
        <CampusOnboardingModal campuses={campuses} userEmail={user?.email} />
      )}
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
    </>
  )
}
