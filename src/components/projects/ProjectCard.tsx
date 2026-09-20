import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import styles from './ProjectCard.module.css'
import patterns from '../../styles/patterns.module.css'
import { Pill } from '../ui'
import { computeProjectProgress, type ProjectRecord } from '../../data'
import { useCounters } from '../../hooks/useCounters'
import { useCoverImageUrl } from '../../hooks/useCoverImageUrl'
import { formatDateFr } from '../../utils/formatDate'
import { STATUS_LABELS, STATUS_PILL_COLORS } from './statusMeta'
import { projectColorVar } from './colorMeta'

const STRIPE_CLASS_BY_COLOR: Record<ProjectRecord['colorKey'], string | undefined> = {
  prune: patterns.stripesProjectPrune,
  pervenche: patterns.stripesProjectPervenche,
  terracotta: patterns.stripesProjectTerracotta,
  peche: patterns.stripesProjectPeche,
  rouge: patterns.stripesProjectRouge,
  rose: patterns.stripesProjectRose,
}

interface ProjectCardProps {
  project: ProjectRecord
}

export function ProjectCard({ project }: ProjectCardProps) {
  const coverUrl = useCoverImageUrl(project.id)
  const counters = useCounters(project.id)
  const progress = computeProjectProgress(counters ?? [])
  const isDone = project.status === 'done'
  // The card always shows a percentage, even without a counter goal to
  // compute a real ratio from: a done project reads 100%, anything else 0%
  // (row counts read as clutter next to the other cards' real percentages).
  // Once progress comes from the guide (step 5b) every project will have a
  // real ratio here.
  const progressPercent = progress.kind === 'percent' ? Math.round(progress.ratio * 100) : isDone ? 100 : 0

  return (
    <Link
      to={`/projets/${project.id}`}
      className={styles.card}
      style={{ borderColor: projectColorVar(project.colorKey) }}
    >
      <div
        className={
          coverUrl ? styles.cover : `${styles.cover} ${patterns.stripes} ${STRIPE_CLASS_BY_COLOR[project.colorKey]}`
        }
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      />

      <Pill color={STATUS_PILL_COLORS[project.status]} className={styles.statusBadge}>
        {STATUS_LABELS[project.status]}
      </Pill>

      {isDone && (
        <span className={styles.doneBadge} aria-label="Projet terminé">
          <CheckCircle2 size={18} strokeWidth={2} />
        </span>
      )}

      <div className={styles.overlay}>
        <span className={styles.progressBadge}>{progressPercent} %</span>
        <div className={styles.name}>{project.name}</div>
        {project.targetEndDate && (
          <div className={styles.endDate}>Fin prévue le {formatDateFr(project.targetEndDate)}</div>
        )}
      </div>
    </Link>
  )
}
