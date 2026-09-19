// Whole-day difference between two YYYY-MM-DD calendar dates (see
// ProjectRecord.startedAt/targetEndDate), computed at local midnight so a
// time-of-day offset never rounds the count up or down by one.
function toMidnight(dateString: string): number {
  return new Date(`${dateString}T00:00:00`).getTime()
}

const DAY_MS = 24 * 60 * 60 * 1000

export function daysBetween(fromDateString: string, toDateString: string): number {
  return Math.round((toMidnight(toDateString) - toMidnight(fromDateString)) / DAY_MS)
}

export function daysSince(dateString: string, today: string): number {
  return daysBetween(dateString, today)
}

export function daysUntil(dateString: string, today: string): number {
  return daysBetween(today, dateString)
}
