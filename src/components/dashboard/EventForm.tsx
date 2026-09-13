'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createEvent, updateEvent } from '@/app/(dashboard)/dashboard/events/actions'
import { eventSchema, type EventFormData } from '@/lib/validations/event'
import { ImageUpload } from '@/components/dashboard/ImageUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { EVENT_CATEGORIES } from '@/lib/constants'

interface EventFormProps {
  mode: 'create' | 'edit'
  initialData?: {
    id: string
    title: string
    description: string
    category: string
    event_date: string
    start_time: string
    end_time: string
    location: string
    capacity: number | null
    banner_url: string | null
    status: 'draft' | 'published' | 'cancelled'
    is_paid: boolean
    price: number | null
    eligibility?: string | null
    registration_deadline?: string | null
    what_to_bring?: string | null
    contact_method?: string | null
    accessibility_notes?: string | null
    map_url?: string | null
    registration_mode?: 'individual' | 'team' | 'both'
    min_team_size?: number | null
    max_team_size?: number | null
    max_teams?: number | null
    venue_id?: string | null
    building?: string | null
    floor?: string | null
    room?: string | null
    latitude?: number | null
    longitude?: number | null
    accessibility_details?: string | null
    directions_url?: string | null
  }
  currentRegistrationCount?: number
  cancelWarning?: {
    activeRegistrations: number
    onConfirm: () => Promise<void>
  }
}

export function EventForm({ mode, initialData, currentRegistrationCount = 0, cancelWarning: _cancelWarning }: EventFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [changeNotice, setChangeNotice] = useState('')
  const [noticeError, setNoticeError] = useState<string | null>(null)
  
  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema) as unknown as Resolver<EventFormData>,
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      category: initialData?.category || EVENT_CATEGORIES[0].value,
      event_date: initialData?.event_date || '',
      start_time: initialData?.start_time || '',
      end_time: initialData?.end_time || '',
      location: initialData?.location || '',
      capacity: initialData?.capacity || null,
      banner_url: initialData?.banner_url || '',
      status: initialData?.status || 'draft',
      is_paid: initialData?.is_paid || false,
      price: initialData?.price || null,
      eligibility: initialData?.eligibility || '',
      registration_deadline: initialData?.registration_deadline ? initialData.registration_deadline.slice(0, 16) : '',
      what_to_bring: initialData?.what_to_bring || '',
      contact_method: initialData?.contact_method || '',
      accessibility_notes: initialData?.accessibility_notes || '',
      map_url: initialData?.map_url || '',
      registration_mode: initialData?.registration_mode || 'individual',
      min_team_size: initialData?.min_team_size ?? 2,
      max_team_size: initialData?.max_team_size ?? 4,
      max_teams: initialData?.max_teams || null,
      venue_id: initialData?.venue_id || '',
      building: initialData?.building || '',
      floor: initialData?.floor || '',
      room: initialData?.room || '',
      latitude: initialData?.latitude || null,
      longitude: initialData?.longitude || null,
      accessibility_details: initialData?.accessibility_details || '',
      directions_url: initialData?.directions_url || '',
      is_recurring: false,
      recurrence_type: 'weekly',
      recurrence_interval: 1,
      recurrence_end_type: 'count',
      recurrence_count: 6,
      recurrence_end_date: '',
    },
    shouldFocusError: true,
  })

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [form.formState.isDirty])

  const onSubmit = async (data: EventFormData) => {
    // Extra validation for capacity if there are existing registrations
    if (
      currentRegistrationCount > 0 &&
      data.capacity !== null &&
      data.capacity < currentRegistrationCount
    ) {
      form.setError('capacity', {
        type: 'manual',
        message: `Capacity cannot be less than current registrations (${currentRegistrationCount})`,
      })
      return
    }

    if (requiresNotice && changeNotice.trim().length < 5) {
      setNoticeError('Please provide an explanation of at least 5 characters for registered attendees.')
      toast.error('Change notice required', {
        description: 'Please explain the schedule or venue change to registered attendees.',
      })
      return
    }

    startTransition(async () => {
      try {
        let finalBannerUrl = data.banner_url

        // Handle image upload if a new file was selected
        if (imageFile) {
          const supabase = createClient()
          const fileExt = imageFile.name.split('.').pop()
          const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
          
          const { error: uploadError, data: uploadData } = await supabase.storage
            .from('event_banners')
            .upload(fileName, imageFile)

          if (uploadError) {
            toast.error('Failed to upload image', { description: uploadError.message })
            return
          }

          const { data: { publicUrl } } = supabase.storage
            .from('event_banners')
            .getPublicUrl(uploadData.path)

          finalBannerUrl = publicUrl
        }

        const payload = {
          ...data,
          banner_url: finalBannerUrl || null,
        }

        if (mode === 'create') {
          const result = await createEvent(payload)
          if (result && !result.success) {
            toast.error('Failed to create event', { description: result.error })
          } else {
            toast.success('Event created successfully')
          }
        } else {
          const result = await updateEvent(
            initialData!.id,
            payload,
            requiresNotice ? changeNotice.trim() : undefined
          )
          if (result && !result.success) {
            toast.error('Failed to update event', { description: result.error })
          } else {
            toast.success('Event updated successfully')
          }
        }
      } catch (error) {
        console.error(error)
        // Redirect throws NEXT_REDIRECT which is expected, so we ignore it here
      }
    })
  }

  const { register, handleSubmit, formState: { errors }, setValue, control } = form
  const bannerUrl = useWatch({ control, name: 'banner_url' })
  const status = useWatch({ control, name: 'status' })
  const isPaid = useWatch({ control, name: 'is_paid' })
  const registrationMode = useWatch({ control, name: 'registration_mode' })
  const isRecurring = useWatch({ control, name: 'is_recurring' })
  const recurrenceEndType = useWatch({ control, name: 'recurrence_end_type' })
  const watchedDate = useWatch({ control, name: 'event_date' })
  const watchedStartTime = useWatch({ control, name: 'start_time' })
  const watchedEndTime = useWatch({ control, name: 'end_time' })
  const watchedLocation = useWatch({ control, name: 'location' })

  const isScheduleOrVenueChanged =
    mode === 'edit' &&
    Boolean(initialData) &&
    (watchedDate !== initialData?.event_date ||
      watchedStartTime !== initialData?.start_time ||
      watchedEndTime !== initialData?.end_time ||
      watchedLocation !== initialData?.location)

  const requiresNotice = Boolean(isScheduleOrVenueChanged && currentRegistrationCount > 0)
  
  const hasRegistrations = currentRegistrationCount > 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Basic Info */}
      <div className="space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-[--text-primary]">Basic Information</h3>
          <p className="text-sm text-[--text-muted]">Give your event a clear identity.</p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Campus Hackathon 2026"
              {...register('title')}
              aria-invalid={errors.title ? 'true' : undefined}
              aria-describedby={errors.title ? 'title-error' : undefined}
              className={cn(errors.title && 'border-red-500')}
            />
            {errors.title && (
              <p id="title-error" role="alert" className="text-xs text-red-500">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <textarea
              id="description"
              placeholder="Tell people what this event is about…"
              rows={5}
              {...register('description')}
              aria-invalid={errors.description ? 'true' : undefined}
              aria-describedby={errors.description ? 'description-error' : undefined}
              className={cn(
                "w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--accent-200]",
                errors.description ? "border-red-500 focus:border-red-500" : "border-[--border-default] focus:border-[--accent-400]"
              )}
            />
            {errors.description && (
              <p id="description-error" role="alert" className="text-xs text-red-500">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <select
              id="category"
              {...register('category')}
              aria-invalid={errors.category ? 'true' : undefined}
              aria-describedby={errors.category ? 'category-error' : undefined}
              className={cn(
                "w-full min-h-[44px] rounded-lg border bg-transparent px-3 py-2 text-sm text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-[--accent-200]",
                errors.category ? "border-red-500 focus:border-red-500" : "border-[--border-default] focus:border-[--accent-400]"
              )}
            >
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            {errors.category && (
              <p id="category-error" role="alert" className="text-xs text-red-500">
                {errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Banner Image</Label>
            <ImageUpload 
              value={bannerUrl || null} 
              onChange={(url, file) => {
                setValue('banner_url', url || '', { shouldDirty: true })
                setImageFile(file)
              }} 
            />
          </div>
        </div>
      </div>

      <hr className="border-[--border-subtle]" />

      {/* Date and Time */}
      <div className="space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-[--text-primary]">Date & Time</h3>
          <p className="text-sm text-[--text-muted]">When is it happening?</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="event_date">Date *</Label>
            <Input
              id="event_date"
              type="date"
              {...register('event_date')}
              aria-invalid={errors.event_date ? 'true' : undefined}
              aria-describedby={errors.event_date ? 'event_date-error' : undefined}
              className={cn(errors.event_date && 'border-red-500')}
            />
            {errors.event_date && (
              <p id="event_date-error" role="alert" className="text-xs text-red-500">
                {errors.event_date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="start_time">Start Time *</Label>
            <Input
              id="start_time"
              type="time"
              {...register('start_time')}
              aria-invalid={errors.start_time ? 'true' : undefined}
              aria-describedby={errors.start_time ? 'start_time-error' : undefined}
              className={cn(errors.start_time && 'border-red-500')}
            />
            {errors.start_time && (
              <p id="start_time-error" role="alert" className="text-xs text-red-500">
                {errors.start_time.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_time">End Time *</Label>
            <Input
              id="end_time"
              type="time"
              {...register('end_time')}
              aria-invalid={errors.end_time ? 'true' : undefined}
              aria-describedby={errors.end_time ? 'end_time-error' : undefined}
              className={cn(errors.end_time && 'border-red-500')}
            />
            {errors.end_time && (
              <p id="end_time-error" role="alert" className="text-xs text-red-500">
                {errors.end_time.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <hr className="border-[--border-subtle]" />

      {/* Location and Capacity */}
      <div className="space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-[--text-primary]">Location & Capacity</h3>
          <p className="text-sm text-[--text-muted]">Where is it and who can join?</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="location">Location / Venue *</Label>
            <Input
              id="location"
              placeholder="e.g. Main Auditorium"
              {...register('location')}
              aria-invalid={errors.location ? 'true' : undefined}
              aria-describedby={errors.location ? 'location-error' : undefined}
              className={cn(errors.location && 'border-red-500')}
            />
            {errors.location && (
              <p id="location-error" role="alert" className="text-xs text-red-500">
                {errors.location.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min={hasRegistrations ? currentRegistrationCount : 1}
              placeholder="Leave empty for unlimited"
              {...register('capacity')}
              aria-invalid={errors.capacity ? 'true' : undefined}
              aria-describedby={errors.capacity ? 'capacity-error' : undefined}
              className={cn(errors.capacity && 'border-red-500')}
            />
            {errors.capacity && (
              <p id="capacity-error" role="alert" className="text-xs text-red-500">
                {errors.capacity.message}
              </p>
            )}
            <p className="text-xs text-[--text-muted]">
              {hasRegistrations 
                ? `Cannot be reduced below current registrations (${currentRegistrationCount}).` 
                : 'Leave empty for unlimited capacity.'}
            </p>
          </div>
        </div>

        {/* Phase 15: Structured Venue & Map Coordinates */}
        <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface]/50 p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-[--text-primary]">Structured Venue Details & Interactive Map</h4>
            <p className="text-xs text-[--text-muted]">
              Provide precise room and GPS coordinates to show an interactive campus map and directions for attendees.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="building" className="text-xs">Building Name</Label>
              <Input
                id="building"
                placeholder="e.g. Science Complex"
                {...register('building')}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="floor" className="text-xs">Floor</Label>
              <Input
                id="floor"
                placeholder="e.g. 2nd Floor"
                {...register('floor')}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room" className="text-xs">Room / Lab Number</Label>
              <Input
                id="room"
                placeholder="e.g. Hall 204"
                {...register('room')}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="latitude" className="text-xs">Latitude (GPS)</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="e.g. 40.7128"
                {...register('latitude')}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="longitude" className="text-xs">Longitude (GPS)</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="e.g. -74.0060"
                {...register('longitude')}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accessibility_details" className="text-xs">Physical Accessibility & Accommodations</Label>
            <Input
              id="accessibility_details"
              placeholder="e.g. Step-free ramp at North entrance, elevator to Floor 2, wheelchair seating"
              {...register('accessibility_details')}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="directions_url" className="text-xs">Custom Walking Directions / Campus Map URL</Label>
            <Input
              id="directions_url"
              type="url"
              placeholder="https://maps.university.edu/buildings/science"
              {...register('directions_url')}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {requiresNotice && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
            <span>⚠️ Notice for Registered Attendees Required</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            You are changing the date, time, or location of an event that has {currentRegistrationCount} registered attendee{currentRegistrationCount > 1 ? 's' : ''}. They will receive an in-app notification with this explanation.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="changeNotice" className="text-xs font-medium text-[--text-primary]">
              Change Explanation / Notice *
            </Label>
            <textarea
              id="changeNotice"
              rows={2}
              value={changeNotice}
              onChange={(e) => {
                setChangeNotice(e.target.value)
                if (noticeError) setNoticeError(null)
              }}
              placeholder="e.g. Due to room scheduling, the start time is moved to 4 PM / location changed to Hall B..."
              className={cn(
                "w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                noticeError && "border-red-500"
              )}
            />
            {noticeError && <p className="text-xs font-medium text-red-600 dark:text-red-400">{noticeError}</p>}
          </div>
        </div>
      )}

      <hr className="border-[--border-subtle]" />

      {/* Pricing */}
      <div className="space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-[--text-primary]">Pricing</h3>
          <p className="text-sm text-[--text-muted]">Is this a free or paid event?</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_paid"
              {...register('is_paid')}
              className="h-4 w-4 rounded border-gray-300 text-[--accent-500] focus:ring-[--accent-500]"
            />
            <Label htmlFor="is_paid" className="cursor-pointer">This is a paid event</Label>
          </div>

          {isPaid && (
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="price">Price (₹) *</Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">₹</span>
                </div>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('price')}
                  className={cn("pl-7", errors.price && 'border-red-500')}
                />
              </div>
              {errors.price && <p className="text-xs text-red-500">{errors.price.message}</p>}
            </div>
          )}
        </div>
      </div>

      <hr className="border-[--border-subtle]" />

      {/* Registration Mode & Team Configuration (Phase 13) */}
      <div className="space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-[--text-primary]">
            Registration Mode & Teams
          </h3>
          <p className="text-sm text-[--text-muted]">
            Choose whether attendees sign up individually, in teams (e.g. hackathons), or both.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="registration_mode">Registration Type</Label>
            <select
              id="registration_mode"
              {...register('registration_mode')}
              className="w-full sm:max-w-xs rounded-lg border border-[--border-default] bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-[--accent-500]"
            >
              <option value="individual">Solo / Individual Attendees Only</option>
              <option value="team">Team Registration Only (Hackathons, Competitions)</option>
              <option value="both">Both Solo and Team Registration Allowed</option>
            </select>
          </div>

          {(registrationMode === 'team' || registrationMode === 'both') && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20 p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="min_team_size" className="text-xs font-medium text-[--text-primary]">
                    Min Team Size *
                  </Label>
                  <Input
                    id="min_team_size"
                    type="number"
                    min={1}
                    max={20}
                    {...register('min_team_size')}
                    className="text-sm bg-white dark:bg-zinc-900"
                  />
                  <p className="text-[11px] text-[--text-muted]">Required to confirm team spots</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="max_team_size" className="text-xs font-medium text-[--text-primary]">
                    Max Team Size *
                  </Label>
                  <Input
                    id="max_team_size"
                    type="number"
                    min={1}
                    max={30}
                    {...register('max_team_size')}
                    className="text-sm bg-white dark:bg-zinc-900"
                  />
                  <p className="text-[11px] text-[--text-muted]">Hard limit per team roster</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="max_teams" className="text-xs font-medium text-[--text-primary]">
                    Max Teams (Optional)
                  </Label>
                  <Input
                    id="max_teams"
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    {...register('max_teams')}
                    className="text-sm bg-white dark:bg-zinc-900"
                  />
                  <p className="text-[11px] text-[--text-muted]">Total teams capacity limit</p>
                </div>
              </div>
              {errors.max_team_size && (
                <p className="text-xs font-medium text-red-500">{errors.max_team_size.message}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {mode === 'create' && (
        <>
          <hr className="border-[--border-subtle]" />

          {/* Recurring Event Series (Phase 13) */}
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-lg font-semibold text-[--text-primary]">
                Recurring Event Series
              </h3>
              <p className="text-sm text-[--text-muted]">
                Repeat this event across a scheduled series without manually recreating each session.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_recurring"
                  {...register('is_recurring')}
                  className="h-4 w-4 rounded border-gray-300 text-[--accent-500] focus:ring-[--accent-500]"
                />
                <Label htmlFor="is_recurring" className="cursor-pointer font-medium">
                  Repeat this event (Create as Event Series)
                </Label>
              </div>

              {isRecurring && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20 p-5 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="recurrence_type" className="text-xs font-medium text-[--text-primary]">
                        Recurrence Pattern
                      </Label>
                      <select
                        id="recurrence_type"
                        {...register('recurrence_type')}
                        className="w-full rounded-lg border border-[--border-default] bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-[--accent-500]"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom interval (in days)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="recurrence_interval" className="text-xs font-medium text-[--text-primary]">
                        Repeat Every
                      </Label>
                      <Input
                        id="recurrence_interval"
                        type="number"
                        min={1}
                        max={30}
                        {...register('recurrence_interval')}
                        className="text-sm bg-white dark:bg-zinc-900"
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="recurrence_end_type" className="text-xs font-medium text-[--text-primary]">
                        End Condition
                      </Label>
                      <select
                        id="recurrence_end_type"
                        {...register('recurrence_end_type')}
                        className="w-full rounded-lg border border-[--border-default] bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-[--accent-500]"
                      >
                        <option value="count">After a specific number of sessions</option>
                        <option value="date">On a specific end date</option>
                      </select>
                    </div>

                    {recurrenceEndType === 'date' ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="recurrence_end_date" className="text-xs font-medium text-[--text-primary]">
                          Series End Date
                        </Label>
                        <Input
                          id="recurrence_end_date"
                          type="date"
                          {...register('recurrence_end_date')}
                          className="text-sm bg-white dark:bg-zinc-900"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label htmlFor="recurrence_count" className="text-xs font-medium text-[--text-primary]">
                          Number of Sessions
                        </Label>
                        <Input
                          id="recurrence_count"
                          type="number"
                          min={2}
                          max={52}
                          {...register('recurrence_count')}
                          className="text-sm bg-white dark:bg-zinc-900"
                          placeholder="6"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <hr className="border-[--border-subtle]" />

      {/* Student Decision & Logistics (Phase 7) */}
      <div className="space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-[--text-primary]">
            Logistics & Student Decision Details (Optional)
          </h3>
          <p className="text-sm text-[--text-muted]">
            Help attendees decide if they qualify, what to prepare, and how to participate.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eligibility">Eligibility / Who Can Attend</Label>
              <Input
                id="eligibility"
                placeholder="e.g. Open to all engineering students"
                {...register('eligibility')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration_deadline">Registration Deadline (Cutoff)</Label>
              <Input
                id="registration_deadline"
                type="datetime-local"
                {...register('registration_deadline')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact_method">Public Contact / Inquiries</Label>
              <Input
                id="contact_method"
                placeholder="e.g. techclub@campus.edu or Discord link"
                {...register('contact_method')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="map_url">Campus Map / Directions Link</Label>
              <Input
                id="map_url"
                type="url"
                placeholder="https://maps.google.com/?q=..."
                {...register('map_url')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="what_to_bring">What to Bring / Requirements</Label>
            <textarea
              id="what_to_bring"
              placeholder="e.g. Laptop, student ID card, water bottle, resume copy"
              rows={3}
              {...register('what_to_bring')}
              className="w-full rounded-lg border border-[--border-default] bg-transparent px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--accent-200]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessibility_notes">Accessibility & Accommodations</Label>
            <textarea
              id="accessibility_notes"
              placeholder="e.g. Wheelchair accessible auditorium, elevator via North Entrance, live captioning provided"
              rows={3}
              {...register('accessibility_notes')}
              className="w-full rounded-lg border border-[--border-default] bg-transparent px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--accent-200]"
            />
          </div>
        </div>
      </div>

      <hr className="border-[--border-subtle]" />

      {/* Publishing */}
      <div className="space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-[--text-primary]">Publishing</h3>
          <p className="text-sm text-[--text-muted]">Manage visibility.</p>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setValue('status', 'draft', { shouldDirty: true })}
              disabled={hasRegistrations}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                status === 'draft'
                  ? 'border-[--border-strong] bg-[--bg-muted] text-[--text-primary]'
                  : 'border-[--border-subtle] text-[--text-secondary] hover:border-[--border-default]',
                hasRegistrations && 'opacity-50 cursor-not-allowed'
              )}
            >
              Draft
            </button>
            <button
              type="button"
              onClick={() => setValue('status', 'published', { shouldDirty: true })}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                status === 'published'
                  ? 'border-[--accent-400] bg-[--accent-50] text-[--accent-700]'
                  : 'border-[--border-subtle] text-[--text-secondary] hover:border-[--border-default]'
              )}
            >
              Published
            </button>
          </div>
          <p className="text-xs text-[--text-muted]">
            {hasRegistrations
              ? "This event has registrations and cannot be unpublished."
              : status === 'draft'
              ? 'Draft events are only visible to you.'
              : 'Published events are visible to everyone on CampusLoop.'}
          </p>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 border-t border-[--border-subtle] pt-6">
        <button
          type="button"
          onClick={() => router.push('/dashboard/events')}
          className="rounded-lg px-4 py-2 text-sm font-medium text-[--text-secondary] transition-colors hover:text-[--text-primary]"
        >
          Cancel
        </button>
        <Button type="submit" disabled={isPending || !form.formState.isDirty}>
          {isPending
            ? mode === 'create'
              ? 'Creating…'
              : 'Saving…'
            : mode === 'create'
            ? 'Create Event'
            : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
