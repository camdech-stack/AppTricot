export function nowIso(): string {
  return new Date().toISOString()
}

// Calendar-date-only string (YYYY-MM-DD), for fields edited via a date
// input (startedAt/completedAt) rather than exact timestamps.
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}
