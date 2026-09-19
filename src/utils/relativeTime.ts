const RTF = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
]

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime()
  const absMs = Math.abs(diffMs)

  if (absMs < 60_000) return "à l'instant"

  for (const { unit, ms } of UNITS) {
    if (absMs >= ms) {
      return RTF.format(Math.round(diffMs / ms), unit)
    }
  }
  return RTF.format(Math.round(diffMs / 60_000), 'minute')
}
