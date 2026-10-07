import type { TimePeriod } from '../data'
import { formatDateFr } from './formatDate'

// Short axis label for a chart bucket key (see TimeBucket.key): dd/MM for a
// day or the Monday of a week, a short month name, or the year.
export function formatBucketLabel(period: TimePeriod, key: string): string {
  if (period === 'year') return key
  if (period === 'month') {
    const [year, month] = key.split('-')
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })
  }
  return formatDateFr(key).slice(0, 5)
}
