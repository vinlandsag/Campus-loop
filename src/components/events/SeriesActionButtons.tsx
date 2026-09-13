'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { registerForEntireSeries } from '@/app/actions/series.actions'
import { generateSeriesIcs } from '@/lib/calendar/ics'
import type { EventSeries } from '@/types'

interface SeriesActionButtonsProps {
  series: EventSeries
  isLoggedIn: boolean
}

export function SeriesActionButtons({ series, isLoggedIn }: SeriesActionButtonsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [registeredSummary, setRegisteredSummary] = useState<string | null>(null)

  const handleRegisterAll = () => {
    if (!isLoggedIn) {
      router.push(`/signup?next=${encodeURIComponent(`/series/${series.slug}`)}`)
      return
    }

    if (
      confirm(
        `Are you sure you want to register for all upcoming eligible sessions in "${series.title}"?`
      )
    ) {
      startTransition(async () => {
        const res = await registerForEntireSeries(series.id)
        if (res.success) {
          setRegisteredSummary(res.message || 'Enrolled in upcoming sessions!')
          toast.success('Series registration complete!', {
            description: res.message,
          })
        } else {
          toast.error('Registration error', {
            description: res.error || 'Could not register for series.',
          })
        }
      })
    }
  }

  const handleDownloadCalendar = () => {
    try {
      const ics = generateSeriesIcs({
        seriesId: series.id,
        seriesTitle: series.title,
        description: series.description,
        organizerName: series.organizer?.display_name,
        sessions: (series.occurrences || [])
          .filter(
            (occ) =>
              occ.status !== 'cancelled' &&
              Boolean(occ.event_date && occ.start_time && occ.end_time)
          )
          .map((occ) => ({
            id: occ.id,
            title: occ.title,
            eventDate: occ.event_date!,
            startTime: occ.start_time!,
            endTime: occ.end_time!,
            location: occ.location,
            description: occ.description,
          })),
      })

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `series-${series.slug}.ics`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Series calendar (.ics) downloaded!')
    } catch (err) {
      console.error('Failed to download series calendar:', err)
      toast.error('Could not generate series calendar file.')
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <Button
        onClick={handleRegisterAll}
        disabled={isPending}
        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-sm"
        size="lg"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Registering for Series...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Register for Full Series
          </>
        )}
      </Button>

      <Button
        variant="outline"
        onClick={handleDownloadCalendar}
        className="gap-2 border-[--border-subtle] font-medium"
        size="lg"
      >
        <Calendar className="h-4 w-4 text-[--text-muted]" />
        Add Series to Calendar
      </Button>

      {registeredSummary && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{registeredSummary}</span>
        </div>
      )}
    </div>
  )
}
