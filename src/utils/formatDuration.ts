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
