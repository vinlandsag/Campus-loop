'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  Search,
  X,
  GraduationCap,
  Users2,
  Tag,
  SlidersHorizontal,
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EVENT_CATEGORIES } from '@/lib/constants'
import type { Campus } from '@/types'

const CATEGORY_OPTIONS = ['All', ...EVENT_CATEGORIES.map((c) => c.label)]

const DATE_OPTIONS = [
  { label: 'All Dates', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Weekend', value: 'weekend' },
  { label: 'This Month', value: 'month' },
]

const COST_OPTIONS = [
  { label: 'All Pricing', value: 'all' },
  { label: 'Free Only', value: 'free' },
  { label: 'Paid Only', value: 'paid' },
]

const FORMAT_OPTIONS = [
  { label: 'All Formats', value: 'all' },
  { label: 'In-Person', value: 'in-person' },
  { label: 'Online / Virtual', value: 'online' },
]

const AVAILABILITY_OPTIONS = [
  { label: 'All Availability', value: 'all' },
  { label: 'Open Spots Only', value: 'open' },
  { label: 'Waitlist Open', value: 'waitlist' },
]

const SORT_OPTIONS = [
  { label: 'Soonest First', value: 'soonest' },
  { label: 'Newest Added', value: 'newest' },
  { label: 'Most Available', value: 'available' },
  { label: 'Most Popular', value: 'popular' },
]

interface EventFiltersProps {
  campuses?: Campus[]
  userCampusSlug?: string | null
  organizers?: Array<{ id: string; full_name: string }>
}

export function EventFilters({
  campuses = [],
  userCampusSlug,
  organizers = [],
}: EventFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialSearch = searchParams.get('q') || ''
  const currentCategory = searchParams.get('category') || 'All'
  const currentDate = searchParams.get('date') || 'all'
  const currentSort = searchParams.get('sort') || 'soonest'
  const currentCampus = searchParams.get('campus') || (userCampusSlug || 'all')
  const currentCost = searchParams.get('cost') || 'all'
  const currentFormat = searchParams.get('format') || 'all'
  const currentAvailability = searchParams.get('availability') || 'all'
  const currentOrganizer = searchParams.get('organizer') || 'all'

  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const debouncedSearchTerm = useDebounce(searchTerm, 400)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [, startTransition] = useTransition()

  // Function to smoothly update search params
  const updateParams = useCallback(
    (key: string, value: string) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())

        if (key === 'campus') {
          if (value && value !== 'all') {
            params.set('campus', value)
          } else if (value === 'all') {
            params.set('campus', 'all')
          } else {
            params.delete('campus')
          }
        } else if (value && value !== 'All' && value !== 'all' && value !== 'soonest') {
          params.set(key, value)
        } else {
          params.delete(key)
        }

        // Reset to page 1 whenever filters change
        if (key !== 'page') {
          params.delete('page')
        }

        router.push(`/events?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, router]
  )

  // Effect to push debounced search to URL
  useEffect(() => {
    if (debouncedSearchTerm !== (searchParams.get('q') || '')) {
      updateParams('q', debouncedSearchTerm)
    }
  }, [debouncedSearchTerm, searchParams, updateParams])

  // Sync internal state if URL changes externally (e.g. back button)
  const urlQ = searchParams.get('q') || ''
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ)
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ)
    setSearchTerm(urlQ)
  }

  const activeFilters: Array<{ label: string; onRemove: () => void }> = []

  if (searchTerm) {
    activeFilters.push({
      label: `"${searchTerm}"`,
      onRemove: () => setSearchTerm(''),
    })
  }
  if (currentCategory !== 'All') {
    activeFilters.push({
      label: currentCategory,
      onRemove: () => updateParams('category', 'All'),
    })
  }
  if (currentDate !== 'all') {
    const label = DATE_OPTIONS.find((d) => d.value === currentDate)?.label || currentDate
    activeFilters.push({
      label,
      onRemove: () => updateParams('date', 'all'),
    })
  }
  if (currentCost !== 'all') {
    const label = COST_OPTIONS.find((c) => c.value === currentCost)?.label || currentCost
    activeFilters.push({
      label,
      onRemove: () => updateParams('cost', 'all'),
    })
  }
  if (currentFormat !== 'all') {
    const label = FORMAT_OPTIONS.find((f) => f.value === currentFormat)?.label || currentFormat
    activeFilters.push({
      label,
      onRemove: () => updateParams('format', 'all'),
    })
  }
  if (currentAvailability !== 'all') {
    const label = AVAILABILITY_OPTIONS.find((a) => a.value === currentAvailability)?.label || currentAvailability
    activeFilters.push({
      label,
      onRemove: () => updateParams('availability', 'all'),
    })
  }
  if (currentOrganizer !== 'all') {
    const orgName = organizers.find((o) => o.id === currentOrganizer)?.full_name || 'Club'
    activeFilters.push({
      label: `Club: ${orgName}`,
      onRemove: () => updateParams('organizer', 'all'),
    })
  }
  if (searchParams.has('campus') && searchParams.get('campus') !== userCampusSlug) {
    const campName = campuses.find((c) => c.slug === searchParams.get('campus'))?.name || searchParams.get('campus')
    activeFilters.push({
      label: `Campus: ${campName === 'all' ? 'All Campuses' : campName}`,
      onRemove: () => updateParams('campus', userCampusSlug || 'all'),
    })
  }

  const hasActiveFilters = activeFilters.length > 0

  const clearFilters = () => {
    setSearchTerm('')
    router.push('/events', { scroll: false })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Primary Filter Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-muted]" />
          <input
            type="search"
            placeholder="Search events by title, description, or room..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-[--border-default] bg-[--bg-surface] pl-9 pr-4 text-sm text-[--text-primary] placeholder:text-[--text-disabled] focus:border-[--accent-400] focus:outline-none focus:ring-2 focus:ring-[--accent-200]"
          />
        </div>

        {/* Primary Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Campus Filter */}
          {campuses && campuses.length > 0 && (
            <Select
              value={currentCampus}
              onValueChange={(val) => updateParams('campus', val || '')}
            >
              <SelectTrigger className="h-10 min-w-[140px] max-w-[200px] rounded-xl bg-[--bg-surface]">
                <GraduationCap className="mr-1.5 h-4 w-4 text-[--accent-600] shrink-0" />
                <SelectValue placeholder="Campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campuses</SelectItem>
                {campuses.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Selector */}
          <Select
            value={currentDate}
            onValueChange={(val) => updateParams('date', val || '')}
          >
            <SelectTrigger className="h-10 w-[130px] rounded-xl bg-[--bg-surface]">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Free vs Paid */}
          <Select
            value={currentCost}
            onValueChange={(val) => updateParams('cost', val || '')}
          >
            <SelectTrigger className="h-10 w-[125px] rounded-xl bg-[--bg-surface]">
              <Tag className="mr-1.5 h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <SelectValue placeholder="Cost" />
            </SelectTrigger>
            <SelectContent>
              {COST_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select
            value={currentSort}
            onValueChange={(val) => updateParams('sort', val || '')}
          >
            <SelectTrigger className="h-10 w-[145px] rounded-xl bg-[--bg-surface]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* More Filters Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="h-10 gap-1.5 rounded-xl text-xs font-medium"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>More Filters</span>
          </Button>
        </div>
      </div>

      {/* Advanced Secondary Filters (Format, Availability, Organizer) */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[--border-subtle] bg-[--bg-muted]/40 p-3 text-xs">
          {/* Format (In-Person / Online) */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[--text-secondary]">Format:</span>
            <div className="flex items-center gap-1">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => updateParams('format', f.value)}
                  className={`rounded-lg px-2.5 py-1 transition-colors ${
                    currentFormat === f.value
                      ? 'bg-[--accent-600] text-white font-medium shadow-sm'
                      : 'bg-[--bg-surface] text-[--text-secondary] hover:text-[--text-primary] border border-[--border-subtle]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Availability (Spots / Waitlist) */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[--text-secondary]">Availability:</span>
            <div className="flex items-center gap-1">
              {AVAILABILITY_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => updateParams('availability', a.value)}
                  className={`rounded-lg px-2.5 py-1 transition-colors ${
                    currentAvailability === a.value
                      ? 'bg-[--accent-600] text-white font-medium shadow-sm'
                      : 'bg-[--bg-surface] text-[--text-secondary] hover:text-[--text-primary] border border-[--border-subtle]'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Club / Organizer Filter */}
          {organizers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[--text-secondary]">Club:</span>
              <Select
                value={currentOrganizer}
                onValueChange={(val) => updateParams('organizer', val || '')}
              >
                <SelectTrigger className="h-7 w-[160px] rounded-lg bg-[--bg-surface] text-xs">
                  <Users2 className="mr-1 h-3 w-3 text-zinc-500 shrink-0" />
                  <SelectValue placeholder="All Clubs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clubs</SelectItem>
                  {organizers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Active Filters Pill Bar */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-[--text-muted]">Active filters:</span>
          {activeFilters.map((af) => (
            <Badge
              key={af.label}
              variant="secondary"
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs px-2.5 py-0.5 font-medium"
            >
              <span>{af.label}</span>
              <button
                type="button"
                onClick={af.onRemove}
                className="rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 p-0.5"
                title="Remove filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline underline-offset-2 ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Categories (Pills) */}
      <div className="scrollbar-hide -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 md:pb-0">
        {CATEGORY_OPTIONS.map((category) => (
          <button
            key={category}
            onClick={() => updateParams('category', category)}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              currentCategory === category
                ? 'border-[--accent-500] bg-[--accent-500] text-white shadow-sm'
                : 'border-[--border-default] bg-[--bg-surface] text-[--text-secondary] hover:border-[--border-strong] hover:text-[--text-primary]'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  )
}
