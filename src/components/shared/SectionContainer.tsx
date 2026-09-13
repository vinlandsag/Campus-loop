import { cn } from '@/lib/utils'

interface SectionContainerProps {
  children: React.ReactNode
  className?: string
  as?: React.ElementType
  id?: string
}

/**
 * Consistent section wrapper applying the page max-width and responsive padding.
 */
export function SectionContainer({
  children,
  className,
  as: Tag = 'section',
  id,
}: SectionContainerProps) {
  return (
    <Tag id={id} className={cn('container-page py-12 md:py-16 lg:py-20', className)}>
      {children}
    </Tag>
  )
}
