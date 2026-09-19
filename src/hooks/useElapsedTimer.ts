import { useEffect, useRef, useState } from 'react'

// Purely visual, in-memory chrono for the counter screen: starts on the
// first tap and can be stopped, but isn't persisted anywhere. Real time
// tracking (sessions, totals, resuming after closing the app) is step 2 —
// this only previews what the counter screen will look like once that
// lands.
export function useElapsedTimer() {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [started, setStarted] = useState(false)
  const [running, setRunning] = useState(false)
  const startedAtRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 1000)
    return () => clearInterval(interval)
  }, [running])

  function start() {
    if (started) return
    startedAtRef.current = Date.now()
    setElapsedMs(0)
    setStarted(true)
    setRunning(true)
  }

  function stop() {
    setRunning(false)
  }

  return { elapsedMs, started, running, start, stop }
}
