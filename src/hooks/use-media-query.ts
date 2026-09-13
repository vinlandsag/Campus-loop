'use client'

import { useState, useEffect } from 'react'

/**
 * Returns whether the viewport matches the given CSS media query.
 * Safely handles SSR by returning `false` on the server.
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 767px)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mql.matches)

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [query])

  return matches
}

/** Convenience hooks for common breakpoints */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
