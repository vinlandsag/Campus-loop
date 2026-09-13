import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface EventStatusBadgeProps {
  status: 'draft' | 'published' | 'cancelled' | 'completed'
  className?: string
}

export function EventStatusBadge({ status, className }: EventStatusBadgeProps) {
  switch (status) {
    case 'draft':
      return (
        <Badge variant="outline" className={cn('bg-[--bg-muted] text-[--text-muted]', className)}>
          Draft
        </Badge>
      )
    case 'published':
      return (
        <Badge variant="secondary" className={cn('bg-[--accent-100] text-[--accent-700] hover:bg-[--accent-100] dark:bg-[--accent-900] dark:text-[--accent-100]', className)}>
          Published
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge variant="destructive" className={cn('bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400', className)}>
          Cancelled
        </Badge>
      )
    case 'completed':
      return (
        <Badge variant="default" className={cn('bg-[--bg-surface] border-[--border-strong] text-[--text-secondary]', className)}>
          Completed
        </Badge>
      )
    default:
      return null
  }
}
