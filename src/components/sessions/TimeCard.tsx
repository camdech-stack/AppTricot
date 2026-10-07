import { useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Gauge, History, Repeat, Timer } from 'lucide-react'
import styles from './TimeCard.module.css'
import { BarHistogram, SegmentedControl, StatTile } from '../ui'
import { formatDuration } from '../../utils/formatDuration'
import { formatDateFr } from '../../utils/formatDate'
import { formatBucketLabel } from '../../utils/formatBucketLabel'
import { useNow } from '../../hooks/useNow'
import {
  aggregateTimeByPeriod,
  computeProjectTimeStats,
  getLiveSessionId,
  getSessionsForTarget,
  type SessionTarget,
} from '../../data'

type CardPeriod = 'day' | 'week' | 'month'

const PERIOD_OPTIONS: { value: CardPeriod; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
]

// Days/weeks/months of history shown for each period tab — "week" matches
// the 8-last-weeks default from CLAUDE.md, the others follow the same
// spirit (enough bars to read a trend without crowding the chart).
function computeRange(period: CardPeriod, now: Date): { from: Date; to: Date } {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (period === 'day') {
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13), to }
  }
  if (period === 'week') {
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * 8), to }
  }
  return { from: new Date(now.getFullYear(), now.getMonth() - 5, now.getDate()), to }
}

interface TimeCardProps {
  target: SessionTarget
  accentColor?: string
  onOpenHistory: () => void
}

// "Temps" card on the project detail page (CLAUDE.md, "Interface" > "Fiche
// projet"): totals, and a small bar histogram by day/week/month.
export function TimeCard({ target, accentColor, onOpenHistory }: TimeCardProps) {
  const [period, setPeriod] = useState<CardPeriod>('week')
  const sessions = useLiveQuery(() => getSessionsForTarget(target), [target.projectId])
  const now = useNow(60_000)
  const liveSessionId = getLiveSessionId()

  const stats = computeProjectTimeStats(sessions ?? [], now, liveSessionId)
  const range = computeRange(period, new Date(now))
  const buckets = aggregateTimeByPeriod(sessions ?? [], period, range, now, liveSessionId)

  return (
    <div className={styles.card} style={accentColor ? ({ '--time-card-accent': accentColor } as CSSProperties) : undefined}>
      <div className={styles.header}>
        <span className={styles.title}>Temps</span>
        <button type="button" className={styles.historyButton} onClick={onOpenHistory}>
          <History size={16} strokeWidth={1.75} />
          Historique
        </button>
      </div>

      <SegmentedControl
        options={PERIOD_OPTIONS}
        value={period}
        onChange={setPeriod}
        label="Période de l'histogramme"
        accentColor={accentColor}
      />

      <div className={styles.statsGrid}>
        <StatTile icon={<Timer size={18} strokeWidth={1.75} />} value={formatDuration(stats.totalMs)} label="Temps total" />
        <StatTile icon={<Repeat size={18} strokeWidth={1.75} />} value={stats.sessionCount} label="Sessions" />
        <StatTile
          icon={<Gauge size={18} strokeWidth={1.75} />}
          value={stats.sessionCount > 0 ? formatDuration(stats.averageMs) : '—'}
          label="Durée moyenne"
        />
        <StatTile
          icon={<CalendarDays size={18} strokeWidth={1.75} />}
          value={stats.lastSessionAt ? formatDateFr(stats.lastSessionAt.slice(0, 10)) : '—'}
          label="Dernière session"
        />
      </div>

      {buckets.length > 0 && (
        <BarHistogram
          ariaLabel={`Temps travaillé par ${PERIOD_OPTIONS.find((o) => o.value === period)?.label.toLowerCase()}`}
          accentColor={accentColor}
          bars={buckets.map((bucket) => ({
            key: bucket.key,
            label: formatBucketLabel(period, bucket.key),
            value: bucket.ms,
            title: `${formatBucketLabel(period, bucket.key)} : ${formatDuration(bucket.ms)}`,
          }))}
        />
      )}
    </div>
  )
}
