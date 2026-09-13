'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, CalendarPlus, Compass, LogOut, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/actions/auth'

interface DashboardSidebarProps {
  user: {
    fullName: string
    email: string
    initials: string
  }
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/events', label: 'My Events', icon: CalendarDays, exact: false },
  { href: '/dashboard/events/new', label: 'Create Event', icon: CalendarPlus, exact: false },
  { href: '/events', label: 'Browse Events', icon: Compass, exact: false },
] as const

export function DashboardSidebar({ user, mobileOpen, onMobileClose }: DashboardSidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-[--border-subtle] px-5">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight transition-opacity hover:opacity-85"
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
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[--text-secondary] hover:bg-[--bg-muted] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-[--accent-50] text-[--accent-700]'
                  : 'text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]'
              )}
            >
              <item.icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-[--accent-600]' : 'text-[--text-muted]')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[--border-subtle] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[--accent-50] text-xs font-semibold text-[--accent-700]">
            {user.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[--text-primary]">{user.fullName}</p>
            <p className="truncate text-xs text-[--text-muted]">{user.email}</p>
          </div>
        </div>
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[--text-secondary] transition-colors hover:bg-[--bg-muted] hover:text-[--text-primary]"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800 lg:bg-white dark:lg:bg-zinc-950">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  )
}
