'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface NavLink {
  href: string
  label: string
}

interface MobileNavProps {
  id: string
  open: boolean
  onClose: () => void
  links: readonly NavLink[]
  currentPath: string
}

/**
 * Full-width mobile navigation drawer that slides in from the top.
 * Traps focus when open and closes on Escape key.
 */
export function MobileNav({ id, open, onClose, links, currentPath }: MobileNavProps) {
  const firstLinkRef = useRef<HTMLAnchorElement>(null)

  // Focus first link when opened
  useEffect(() => {
    if (open) {
      firstLinkRef.current?.focus()
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <nav
        id={id}
        aria-label="Mobile navigation"
        className={cn(
          'fixed inset-x-0 top-16 z-40 border-b border-[--border-subtle] bg-[--bg-surface] px-4 pb-6 pt-4 transition-all duration-200 md:hidden',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        )}
      >
        <ul className="space-y-1" role="list">
          {links.map((link, i) => {
            const isActive = currentPath === link.href || currentPath.startsWith(link.href + '/')
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  ref={i === 0 ? firstLinkRef : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'block rounded-md px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[--bg-muted] text-[--text-primary]'
                      : 'text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]'
                  )}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-2 border-t border-[--border-subtle] pt-4">
          <Link
            href="/login"
            className="block rounded-md px-4 py-2.5 text-center text-sm font-medium text-[--text-secondary] transition-colors hover:bg-[--bg-muted] hover:text-[--text-primary]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="block rounded-md bg-[--accent-500] px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[--accent-600]"
          >
            Sign up
          </Link>
        </div>
      </nav>
    </>
  )
}
