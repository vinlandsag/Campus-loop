import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

/**
 * Reusable page header with title, optional description, and an action slot.
 */
export function PageHeader({ title, description, className, children }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-1">
        <h1 className="font-display text-[length:clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight text-[--text-primary]">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-base text-[--text-muted]">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </div>
  )
}
