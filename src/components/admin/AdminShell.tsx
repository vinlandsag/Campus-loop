'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  Flag,
  ScrollText,
  Shield,
  Menu,
  X,
  LogOut,
} from 'lucide-react'

interface AdminShellProps {
  admin: {
    fullName: string
    email: string
    initials: string
  }
  children: React.ReactNode
}

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/organizers', label: 'Organizers', icon: Users },
  { href: '/admin/colleges', label: 'Colleges', icon: GraduationCap },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
]

export function AdminShell({ admin, children }: AdminShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-dvh bg-[--bg-base]">
      {/* Sidebar — Desktop */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-[--border-subtle] bg-[--bg-surface] lg:flex lg:flex-col">
        <SidebarContent pathname={pathname} admin={admin} />
      </aside>

      {/* Sidebar — Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 flex-col border-r border-[--border-subtle] bg-[--bg-surface]">
            <div className="flex items-center justify-end p-4">
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-[--text-muted] hover:bg-[--bg-muted]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent pathname={pathname} admin={admin} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b border-[--border-subtle] bg-[--bg-surface] px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-[--text-muted] hover:bg-[--bg-muted]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            <span className="font-display text-sm font-bold text-[--text-primary]">
              Admin Panel
            </span>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function SidebarContent({
  pathname,
  admin,
}: {
  pathname: string
  admin: { fullName: string; email: string; initials: string }
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-[--border-subtle] px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-sm font-bold text-[--text-primary]">CampusLoop</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Admin Panel
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                  : 'text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Admin profile */}
      <div className="border-t border-[--border-subtle] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            {admin.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[--text-primary]">
              {admin.fullName}
            </p>
            <p className="truncate text-xs text-[--text-muted]">{admin.email}</p>
          </div>
        </div>
        <form action="/api/auth/callback" method="POST" className="mt-3">
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[--border-subtle] px-3 py-1.5 text-xs font-medium text-[--text-secondary] transition-colors hover:bg-[--bg-muted]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit Admin
          </Link>
        </form>
      </div>
    </>
  )
}
