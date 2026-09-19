import { useEffect, useState } from 'react'
import { formatRelativeTime } from '../utils/relativeTime'

// Re-renders every minute so "il y a X min" stays accurate without a
// per-second timer.
export function useRelativeTime(iso: string | null | undefined): string | undefined {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => forceRender((tick) => tick + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!iso) return undefined
  return formatRelativeTime(iso)
}
