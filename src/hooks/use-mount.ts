'use client'

import { useState, useEffect } from 'react'

/**
 * Returns `true` after the component has mounted on the client.
 * Useful for safely rendering browser-only UI that would otherwise
 * cause a hydration mismatch.
 */
export function useMount(): boolean {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  return mounted
}
