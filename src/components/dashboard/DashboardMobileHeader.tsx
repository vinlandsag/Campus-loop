'use client'

import { Menu } from 'lucide-react'

interface DashboardMobileHeaderProps {
  onMenuToggle: () => void
  title?: string
}

export function DashboardMobileHeader({ onMenuToggle, title }: DashboardMobileHeaderProps) {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 lg:hidden">
      <button
        onClick={onMenuToggle}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>
      {title && (
        <h1 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
      )}
    </div>
  )
}
