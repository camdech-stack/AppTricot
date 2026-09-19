// Displays a YYYY-MM-DD calendar date (see ProjectRecord.startedAt) the way
// a French user expects, without pulling in a date-formatting library.
export function formatDateFr(dateString: string): string {
  const [year, month, day] = dateString.split('-')
  if (!year || !month || !day) return dateString
  return `${day}/${month}/${year}`
}
