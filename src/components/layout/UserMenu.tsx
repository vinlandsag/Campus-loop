'use client'

import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { LogOut, Settings, LayoutDashboard, Calendar, Heart, Compass, Users } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { signOut } from '@/lib/actions/auth'
import { clearAllOfflineRosters } from '@/lib/offline/roster-storage'

interface UserMenuProps {
  user: User
  isOrganizer?: boolean
}

export function UserMenu({ user, isOrganizer = false }: UserMenuProps) {
  // Try to get initials from metadata if available
  const fullName = user.user_metadata?.full_name || ''
  const initials = fullName
    ? fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full border border-[--border-subtle] bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.user_metadata?.avatar_url} alt={fullName || user.email || 'Avatar'} />
          <AvatarFallback className="bg-[--accent-50] text-xs text-[--accent-700]">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none text-[--text-primary]">
                {fullName || 'Account'}
              </p>
              <p className="text-xs leading-none text-[--text-muted]">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {isOrganizer && (
            <DropdownMenuItem>
              <Link href="/dashboard" className="flex w-full cursor-pointer items-center">
                <LayoutDashboard className="mr-2 h-4 w-4 text-[--text-secondary]" />
                <span>Dashboard</span>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem>
            <Link href="/my-events" className="flex w-full cursor-pointer items-center">
              <Calendar className="mr-2 h-4 w-4 text-[--text-secondary]" />
              <span>My Events</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href="/following" className="flex w-full cursor-pointer items-center">
              <Compass className="mr-2 h-4 w-4 text-[--text-secondary]" />
              <span>Following</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href="/friends" className="flex w-full cursor-pointer items-center">
              <Users className="mr-2 h-4 w-4 text-[--text-secondary]" />
              <span>Friends</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href="/favorites" className="flex w-full cursor-pointer items-center">
              <Heart className="mr-2 h-4 w-4 text-[--text-secondary]" />
              <span>Favorites</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href="/settings" className="flex w-full cursor-pointer items-center">
              <Settings className="mr-2 h-4 w-4 text-[--text-secondary]" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <form action={signOut} className="w-full">
            <button
              type="submit"
              onClick={() => clearAllOfflineRosters()}
              className="flex w-full cursor-pointer items-center text-left text-[--accent-600] dark:text-[--accent-400]"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
