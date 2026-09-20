// Single French duration formatter (see CLAUDE.md "Formatage des durées"),
// used everywhere a session/time-tracking duration is shown: "12 h 30"
// above an hour, "45 min" below, "< 1 min" below a minute.
export function formatDuration(ms: number): string {
  if (ms < 60_000) return '< 1 min'

  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${pad2(minutes)}`
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

// hh:mm:ss clock format, for the live chrono button on the counter screen —
// the one place a duration needs second-level precision (CLAUDE.md "Suivi
// du temps"). Everywhere else keeps the French formatDuration above.
export function formatClockDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}
