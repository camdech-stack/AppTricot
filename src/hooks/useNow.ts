import { useEffect, useState } from 'react'

// A `Date.now()` snapshot refreshed every `intervalMs`, read from an effect
// rather than called directly during render — lets components compute a
// live duration without depending on an in-memory chronometer (all
// durations are still derived from stored timestamps, see CLAUDE.md).
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(interval)
  }, [intervalMs])

  return now
}
