'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'
import { MobileNav } from './MobileNav'
import { UserMenu } from './UserMenu'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import type { User } from '@supabase/supabase-js'
import { CampusSelector } from '@/components/campus/CampusSelector'
import type { Campus } from '@/types'

const NAV_LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/following', label: 'Following', authOnly: true },
  { href: '/friends', label: 'Friends', authOnly: true },
  { href: '/settings', label: 'Settings', authOnly: true },
  { href: '/dashboard', label: 'Dashboard', organizerOnly: true },
] as const

interface NavbarProps {
  user: User | null
  isOrganizer: boolean
  campuses?: Campus[]
  initialCampus?: string
  currentCampus?: Campus | null
}

export function Navbar({
  user,
  isOrganizer = false,
  campuses = [],
  currentCampus,
}: NavbarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  const [scrolled, setScrolled] = useState(false)

  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setMobileOpen(false)
  }

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const visibleLinks = NAV_LINKS.filter((link) => {
    if ('organizerOnly' in link && link.organizerOnly && !isOrganizer) return false
    if ('authOnly' in link && link.authOnly && !user) return false
    return true
  })

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 w-full transition-all duration-200',
          scrolled
            ? 'border-b border-[--border-subtle] bg-[--bg-surface]/95 shadow-[--shadow-xs] backdrop-blur-md'
            : 'border-b border-transparent bg-[--bg-surface]'
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight transition-opacity hover:opacity-85"
            aria-label={`${APP_NAME} — home`}
          >
            <Image
              src="/logo-icon.png"
              alt="CampusLoop Logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
            <span className="text-[--text-primary]">
              Campus<span className="text-[--accent-500]">Loop</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 md:flex"
          >
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  pathname === link.href || pathname.startsWith(link.href + '/')
                    ? 'bg-[--bg-muted] text-[--text-primary]'
                    : 'text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]'
                )}
                aria-current={pathname === link.href ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            {campuses && campuses.length > 0 && (
              <CampusSelector currentCampus={currentCampus} campuses={campuses} />
            )}
            {user ? (
              <>
                <NotificationBell />
                <UserMenu user={user} isOrganizer={isOrganizer} />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-[--text-secondary] transition-colors hover:text-[--text-primary]"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-[--accent-500] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[--accent-600]"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 md:hidden">
            {campuses && campuses.length > 0 && (
              <CampusSelector currentCampus={currentCampus} campuses={campuses} variant="compact" />
            )}
            {user && <NotificationBell />}
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[--text-secondary] transition-colors hover:bg-[--bg-muted] hover:text-[--text-primary]"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <MobileNav
        id="mobile-nav"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={visibleLinks}
        currentPath={pathname}
      />
    </>
  )
}
