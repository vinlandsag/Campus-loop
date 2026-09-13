import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
}

/**
 * Accessible loading spinner with optional screen-reader label.
 */
export function LoadingSpinner({ size = 'md', className, label = 'Loading…' }: LoadingSpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center', className)}>
      <span
        className={cn(
          'animate-spin rounded-full border-[--border-default] border-t-[--accent-500]',
          sizeMap[size]
        )}
      />
    </span>
  )
}

/**
 * Full-page loading overlay — used in loading.tsx route segments.
 */
export function PageLoadingSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}
