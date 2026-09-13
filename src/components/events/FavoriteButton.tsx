'use client'

import { useTransition, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { toggleFavorite } from '@/app/(public)/events/[slug]/actions'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  eventId: string
  slug: string
  isFavorited: boolean
  isAuthenticated: boolean
  variant?: 'button' | 'icon'
  className?: string
}

export function FavoriteButton({
  eventId,
  slug,
  isFavorited,
  isAuthenticated,
  variant = 'button',
  className,
}: FavoriteButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [optimisticFavorited, setOptimisticFavorited] = useOptimistic(
    isFavorited,
    (_state, newFavorited: boolean) => newFavorited
  )

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/events/${slug}`)}`)
      return
    }

    // Optimistically update the UI instantly
    startTransition(async () => {
      setOptimisticFavorited(!optimisticFavorited)

      const result = await toggleFavorite(eventId, slug, optimisticFavorited)
      if (result.success) {
        toast.success(!optimisticFavorited ? 'Added to favorites' : 'Removed from favorites')
      } else {
        toast.error('Action failed', {
          description: result.error,
        })
      }
    })
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-label={optimisticFavorited ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={optimisticFavorited}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur-md transition-all hover:scale-110 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent-400]',
          className
        )}
      >
        <Heart
          className={cn(
            'h-4 w-4 transition-colors',
            optimisticFavorited
              ? 'fill-red-500 text-red-500'
              : 'text-[--text-secondary] hover:text-red-500'
          )}
        />
      </button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      aria-label={optimisticFavorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={optimisticFavorited}
      className={cn('w-full sm:w-auto', className)}
    >
      <Heart
        className={`mr-2 h-4 w-4 transition-colors ${
          optimisticFavorited ? 'fill-red-500 text-red-500' : ''
        }`}
      />
      {optimisticFavorited ? 'Favorited' : 'Add to Favorites'}
    </Button>
  )
}
