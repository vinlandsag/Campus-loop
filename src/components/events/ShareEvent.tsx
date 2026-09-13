'use client'

import { useState } from 'react'
import { Share2, Check, Copy, Calendar, Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  generateEventIcs,
  createGoogleCalendarUrl,
  createOutlookCalendarUrl,
} from '@/lib/calendar/ics'

interface ShareEventProps {
  id?: string
  title: string
  description?: string | null
  location: string
  eventDate: string
  startTime: string
  endTime: string
  startsAt?: string | null
  endsAt?: string | null
  timezone?: string | null
  sequence?: number | null
}

export function ShareEvent({ 
  id,
  title, 
  description, 
  location, 
  eventDate, 
  startTime, 
  endTime,
  startsAt,
  endsAt,
  timezone,
  sequence,
}: ShareEventProps) {
  const [copied, setCopied] = useState(false)

  const eventOptions = {
    id: id || 'event',
    title,
    description,
    location,
    eventDate,
    startTime,
    endTime,
    startsAt,
    endsAt,
    timezone,
    sequence,
    url: typeof window !== 'undefined' ? window.location.href : null,
  }

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description || undefined,
          url,
        })
        return
      } catch {
        // user cancelled or silent failure
      }
    }
    handleCopy()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      toast.success('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link.')
    }
  }

  const handleGoogleCalendar = () => {
    const url = createGoogleCalendarUrl(eventOptions)
    window.open(url, '_blank')
  }

  const handleOutlookCalendar = () => {
    const url = createOutlookCalendarUrl(eventOptions)
    window.open(url, '_blank')
  }

  const handleDownloadIcs = () => {
    try {
      const icsContent = generateEventIcs(eventOptions)
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'event'}.ics`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('Calendar file downloaded!')
    } catch (err) {
      console.error('Failed to download calendar file:', err)
      toast.error('Could not generate calendar file.')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full sm:w-auto')}>
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Share2 className="mr-2 h-4 w-4" />
              Share / Add to Calendar
            </>
          )}
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          Share Event
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleGoogleCalendar}>
          <Calendar className="mr-2 h-4 w-4" />
          Add to Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOutlookCalendar}>
          <Calendar className="mr-2 h-4 w-4" />
          Add to Outlook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadIcs}>
          <Download className="mr-2 h-4 w-4" />
          Download .ics File
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
