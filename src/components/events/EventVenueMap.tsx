'use client'

import { MapPin, Navigation, Accessibility, ExternalLink, Building2, Layers, Compass } from 'lucide-react'

interface EventVenueMapProps {
  location: string
  building?: string | null
  floor?: string | null
  room?: string | null
  latitude?: number | null
  longitude?: number | null
  accessibilityDetails?: string | null
  directionsUrl?: string | null
  eventTitle?: string
}

export function EventVenueMap({
  location,
  building,
  floor,
  room,
  latitude,
  longitude,
  accessibilityDetails,
  directionsUrl,
  eventTitle,
}: EventVenueMapProps) {
  // Validate coordinates: latitude in [-90, 90], longitude in [-180, 180]
  const hasValidCoordinates =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180

  const googleMapsUrl = hasValidCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`

  const appleMapsUrl = hasValidCoordinates
    ? `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(building || location)}`
    : `https://maps.apple.com/?q=${encodeURIComponent(location)}`

  const primaryDirectionsUrl = directionsUrl || googleMapsUrl

  return (
    <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] overflow-hidden shadow-sm">
      {/* Map Preview ONLY when valid coordinates exist */}
      {hasValidCoordinates && (
        <div className="relative w-full h-56 bg-zinc-100 dark:bg-zinc-800 border-b border-[--border-subtle] overflow-hidden group">
          <iframe
            title={`Venue Map for ${eventTitle || location}`}
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            marginHeight={0}
            marginWidth={0}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.003}%2C${latitude - 0.002}%2C${longitude + 0.003}%2C${latitude + 0.002}&layer=mapnik&marker=${latitude}%2C${longitude}`}
            className="w-full h-full border-0 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-300"
            loading="lazy"
          />

          {/* Overlay Tag */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80 pointer-events-none">
            <Compass className="h-3.5 w-3.5 text-blue-600" />
            <span>Interactive Campus Coordinates ({latitude.toFixed(4)}, {longitude.toFixed(4)})</span>
          </div>

          <a
            href={primaryDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:scale-105"
          >
            <Navigation className="h-3.5 w-3.5" />
            Open Directions
          </a>
        </div>
      )}

      {/* Structured Details Card */}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <h4 className="font-semibold text-sm text-[--text-primary] leading-snug">
                  {building ? `${building}` : location}
                </h4>
                {building && (
                  <p className="text-xs text-[--text-secondary]">{location}</p>
                )}
              </div>
            </div>
          </div>

          {/* Directions Links */}
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
              title="Open in Google Maps"
            >
              <span>Google Maps</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Open in Apple Maps"
            >
              <span>Apple Maps</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Floor & Room Badges */}
        {(building || floor || room) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[--border-subtle]/60">
            {building && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[--bg-muted] px-2.5 py-1 text-xs font-medium text-[--text-secondary]">
                <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                <span>Bldg: {building}</span>
              </span>
            )}
            {floor && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[--bg-muted] px-2.5 py-1 text-xs font-medium text-[--text-secondary]">
                <Layers className="h-3.5 w-3.5 text-zinc-500" />
                <span>Floor {floor}</span>
              </span>
            )}
            {room && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-1 text-xs font-semibold">
                Room {room}
              </span>
            )}
          </div>
        )}

        {/* Accessibility Details */}
        {accessibilityDetails && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
              <Accessibility className="h-3.5 w-3.5" />
              <span>Accessibility & Physical Access</span>
            </div>
            <p className="text-amber-800 dark:text-amber-200/90 leading-relaxed">
              {accessibilityDetails}
            </p>
          </div>
        )}

        {/* Custom Directions URL */}
        {directionsUrl && directionsUrl !== googleMapsUrl && (
          <div className="pt-1">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Navigation className="h-3 w-3" />
              <span>Campus Navigation & Walking Guide</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
