import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { EventListCard } from '@/components/events/EventListCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { FavoriteButton } from '@/components/events/FavoriteButton'
import type { Database } from '@/types/database.types'

export default async function FavoritesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all user favorites with event details
  const { data: favorites, error } = await supabase
    .from('favorites')
    .select(`
      *,
      event:events (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching favorites:', error.message)
  }

  const hasFavorites = favorites && favorites.length > 0

  return (
    <SectionContainer className="py-10 md:py-16">
      <div className="mb-8 md:mb-12">
        <h1 className="font-display text-3xl font-bold text-[--text-primary] md:text-4xl">
          Favorites
        </h1>
        <p className="mt-2 text-[--text-secondary]">
          Events you&apos;ve bookmarked for later.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {!hasFavorites ? (
          <EmptyState
            title="No favorites yet"
            description="You haven't bookmarked any events. Discover upcoming events to add them here."
            actionLabel="Discover Events"
            actionHref="/events"
          />
        ) : (
          (favorites as unknown as Array<{ id: string; event: Database['public']['Tables']['events']['Row'] }>).map((fav) => {
            const event = fav.event
            return (
              <EventListCard
                key={fav.id}
                id={event.id}
                title={event.title}
                slug={event.slug}
                category={event.category}
                event_date={event.event_date}
                start_time={event.start_time}
                location={event.location}
                banner_url={event.banner_url}
                statusLabel={
                  <div className="flex h-full items-center">
                    <FavoriteButton
                      eventId={event.id}
                      slug={event.slug}
                      isFavorited={true}
                      isAuthenticated={true}
                    />
                  </div>
                }
              />
            )
          })
        )}
      </div>
    </SectionContainer>
  )
}
