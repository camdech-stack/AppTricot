import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Hourglass, Layers, PauseCircle, Repeat, Timer, CircleDashed } from 'lucide-react'
import styles from './StatsPage.module.css'
import { BarHistogram, Card, SectionTitle, SegmentedControl, StatTile } from '../components/ui'
import { useStatsOverview } from '../hooks/useStatsOverview'
import { useSettings } from '../hooks/useSettings'
import { formatDuration, formatTotalDuration } from '../utils/formatDuration'
import { formatBucketLabel } from '../utils/formatBucketLabel'
import { formatSkeins, formatYarnAmount } from '../utils/formatYarnQuantity'
import type { StatsView } from '../data'

const VIEW_OPTIONS: { value: StatsView; label: string }[] = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
  { value: 'all', label: 'Tout' },
]

const VIEW_PHRASE: Record<StatsView, string> = {
  week: 'cette semaine',
  month: 'ce mois-ci',
  year: 'cette année',
  all: 'depuis le début',
}

const MAX_AXIS_LABELS = 8

export function StatsPage() {
  const [view, setView] = useState<StatsView>('week')
  const overview = useStatsOverview(view)
  const settings = useSettings()
  const showTime = settings?.trackingEnabled ?? true
  const lengthUnit = settings?.lengthUnit ?? 'm'

  const phrase = VIEW_PHRASE[view]

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Statistiques</h1>
      <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} label="Période des statistiques" fullWidth />

      {overview === undefined ? null : (
        <div className={styles.grid}>
          <Card className={styles.wide}>
            <SectionTitle title="Projets" />
            <div className={styles.tiles}>
              <StatTile icon={<CircleDashed />} value={overview.dashboard.byStatus.todo} label="À faire" color="gold" />
              <StatTile icon={<Hourglass />} value={overview.dashboard.byStatus.in_progress} label="En cours" color="blue" />
              <StatTile icon={<PauseCircle />} value={overview.dashboard.byStatus.paused} label="En pause" color="terracotta" />
              <StatTile icon={<CheckCircle2 />} value={overview.dashboard.byStatus.done} label="Terminés" color="sage" />
            </div>
            <p className={styles.caption}>
              {overview.dashboard.projectCount} projet{overview.dashboard.projectCount > 1 ? 's' : ''} · {overview.dashboard.patternCount}{' '}
              patron{overview.dashboard.patternCount > 1 ? 's' : ''} · {overview.dashboard.guideCount} guide
              {overview.dashboard.guideCount > 1 ? 's' : ''} · {overview.dashboard.yarnInStockCount} fil
              {overview.dashboard.yarnInStockCount > 1 ? 's' : ''} en stock
            </p>
          </Card>

          <Card className={styles.wide}>
            <SectionTitle title={`Vue d'ensemble — ${phrase}`} />
            <div className={styles.tiles}>
              {showTime && <StatTile icon={<Timer />} value={formatTotalDuration(overview.time.totalMs)} label="Temps de tricot" />}
              {showTime && <StatTile icon={<Repeat />} value={overview.time.sessionCount} label="Sessions" color="blue" />}
              <StatTile icon={<CheckCircle2 />} value={overview.completedInRange} label="Projets terminés" color="sage" />
              <StatTile icon={<Layers />} value={formatSkeins(overview.yarn.totalSkeins)} label="Laine consommée" color="terracotta" />
            </div>
          </Card>

          {showTime && (
            <Card>
              <SectionTitle title="Temps de tricot" />
              <BarHistogram
                fit
                labelStep={Math.ceil(overview.timeBuckets.length / MAX_AXIS_LABELS)}
                ariaLabel={`Temps de tricot ${phrase}`}
                bars={overview.timeBuckets.map((bucket) => ({
                  key: bucket.key,
                  label: formatBucketLabel(overview.window.period, bucket.key),
                  value: bucket.ms,
                  title: `${formatBucketLabel(overview.window.period, bucket.key)} : ${formatDuration(bucket.ms)}`,
                }))}
              />
              {overview.time.standaloneMs > 0 && (
                <p className={styles.caption}>dont {formatDuration(overview.time.standaloneMs)} sur le compteur de rang</p>
              )}
            </Card>
          )}

          <Card>
            <SectionTitle title="Projets terminés" />
            <BarHistogram
              fit
              accentColor="var(--color-sage)"
              labelStep={Math.ceil(overview.completedBuckets.length / MAX_AXIS_LABELS)}
              ariaLabel={`Projets terminés ${phrase}`}
              bars={overview.completedBuckets.map((bucket) => ({
                key: bucket.key,
                label: formatBucketLabel(overview.window.period, bucket.key),
                value: bucket.count,
                title: `${formatBucketLabel(overview.window.period, bucket.key)} : ${bucket.count}`,
              }))}
            />
            <Link to="/stats/termines" className={styles.historyLink}>
              Historique des projets terminés
              <ChevronRight size={18} strokeWidth={1.75} />
            </Link>
          </Card>

          <Card>
            <SectionTitle title={`Laine consommée — ${phrase}`} />
            <div className={styles.tiles}>
              <StatTile icon={<Layers />} value={formatYarnAmount(overview.yarn.totalGrams, 'g', lengthUnit)} label="Poids" color="terracotta" />
              <StatTile icon={<Layers />} value={formatYarnAmount(overview.yarn.totalMeters, 'm', lengthUnit)} label="Métrage" color="gold" />
              <StatTile icon={<Layers />} value={overview.yarn.yarnsUsedCount} label="Fils utilisés" />
            </div>
            {overview.yarn.partial && (
              <p className={styles.caption}>Estimation : certains fils n'ont pas de poids ou de métrage par pelote.</p>
            )}
            {overview.yarn.topYarns.length > 0 && (
              <ol className={styles.topYarns}>
                {overview.yarn.topYarns.map((yarn) => (
                  <li key={yarn.yarnId}>
                    <Link to={`/laine/${yarn.yarnId}`}>{yarn.name}</Link>
                    <span>{formatSkeins(yarn.skeins)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
