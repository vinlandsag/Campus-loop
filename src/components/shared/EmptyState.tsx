import Link from 'next/link'
import { Calendar, Search } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  icon?: 'calendar' | 'search'
}

export function EmptyState({ 
  title, 
  description, 
  actionLabel = 'Discover events', 
  actionHref = '/events',
  icon = 'calendar'
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[--border-default] bg-[--bg-surface] px-6 py-16 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[--bg-muted]">
        {icon === 'calendar' ? (
          <Calendar className="h-8 w-8 text-[--text-muted]" />
        ) : (
          <Search className="h-8 w-8 text-[--text-muted]" />
        )}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-[--text-primary]">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-[--text-secondary]">
        {description}
      </p>
      
      {actionLabel && actionHref && (
        <Link href={actionHref} className={cn(buttonVariants({ variant: "default" }), "mt-8")}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
