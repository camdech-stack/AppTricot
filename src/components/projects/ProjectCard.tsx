import { Link } from 'react-router-dom'
import styles from './ProjectCard.module.css'
import patterns from '../../styles/patterns.module.css'
import { Pill, StripedProgressBar } from '../ui'
import { computeProjectProgress, type ProjectRecord } from '../../data'
import { useCounters } from '../../hooks/useCounters'
import { useCoverImageUrl } from '../../hooks/useCoverImageUrl'
import { useRelativeTime } from '../../hooks/useRelativeTime'
import { STATUS_LABELS, STATUS_PILL_COLORS } from './statusMeta'

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
  const lastActivity = useRelativeTime(project.lastActivityAt)
  const progress = computeProjectProgress(counters ?? [])

  return (
    <Link to={`/projets/${project.id}`} className={styles.card}>
      <div
        className={coverUrl ? styles.cover : `${styles.cover} ${patterns.stripes} ${STRIPE_CLASS_BY_COLOR[project.colorKey]}`}
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      />
      <div className={styles.body}>
        <div className={styles.name}>{project.name}</div>
        <Pill color={STATUS_PILL_COLORS[project.status]}>{STATUS_LABELS[project.status]}</Pill>
        {progress.kind === 'percent' ? (
          <StripedProgressBar
            progress={progress.ratio}
            projectColor={project.colorKey}
            label={`Progression de ${project.name}`}
          />
        ) : (
          <div className={styles.rowsCount}>{progress.rows} rangs</div>
        )}
        {lastActivity && <div className={styles.activity}>Activité {lastActivity}</div>}
      </div>
    </Link>
  )
}
