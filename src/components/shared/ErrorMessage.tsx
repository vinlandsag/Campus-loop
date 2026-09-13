import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorMessageProps {
  title?: string
  message: string
  className?: string
  action?: React.ReactNode
}

/**
 * Inline error message component — used within forms and data-fetching components.
 */
export function ErrorMessage({
  title = 'Something went wrong',
  message,
  className,
  action,
}: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4',
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-red-900">{title}</p>
        <p className="text-sm text-red-700">{message}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}
