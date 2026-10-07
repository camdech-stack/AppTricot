import { Link, useNavigate } from 'react-router-dom'
import styles from './ResumeCard.module.css'
import patterns from '../../styles/patterns.module.css'
import { Button, Pill, StripedProgressBar } from '../ui'
import { useCoverImageUrl } from '../../hooks/useCoverImageUrl'
import { useRelativeTime } from '../../hooks/useRelativeTime'
import { formatDuration } from '../../utils/formatDuration'
import { formatResumePoint } from '../../utils/formatResumePoint'
import { getContinueRoute } from '../projects/continueRoute'
import { projectColorVar } from '../projects/colorMeta'
import { PROJECT_STRIPE_CLASS } from '../projects/stripeMeta'
import type { ActiveProjectSummary } from '../../data'

interface ResumeCardProps {
  summary: ActiveProjectSummary
  showTime: boolean
}

function resumeText(summary: ActiveProjectSummary): string | null {
  const { resume } = summary
  if (resume.kind === 'guide') return resume.description ? formatResumePoint(resume.description) : null
  if (resume.kind === 'counter') return `${resume.counterName} : ${resume.value}`
  return null
}

// One "En cours" project on the home screen: pure presentation of an
// ActiveProjectSummary — every figure was already computed by
// getActiveProjectsSummary.
export function ResumeCard({ summary, showTime }: ResumeCardProps) {
  const navigate = useNavigate()
  const { project, progress, timeStats, continueTarget } = summary
  const coverUrl = useCoverImageUrl(project.id)
  const lastActivity = useRelativeTime(summary.lastActivityAt)
  const text = resumeText(summary)
  const percent = progress.kind === 'percent' ? Math.round(progress.ratio * 100) : null

  return (
    <div className={styles.card} style={{ borderColor: projectColorVar(project.colorKey) }}>
      <Link to={`/projets/${project.id}`} className={styles.main} aria-label={`Ouvrir le projet ${project.name}`}>
        <div
          className={coverUrl ? styles.thumb : `${styles.thumb} ${patterns.stripes} ${PROJECT_STRIPE_CLASS[project.colorKey]}`}
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
        />
        <div className={styles.info}>
          <div className={styles.name}>{project.name}</div>
          {text && <div className={styles.resumeText}>{text}</div>}
          {percent !== null && (
            <div className={styles.progressRow}>
              <StripedProgressBar progress={progress.kind === 'percent' ? progress.ratio : 0} projectColor={project.colorKey} label={`Progression de ${project.name}`} />
              <span className={styles.percent}>{percent} %</span>
            </div>
          )}
          <div className={styles.meta}>
            {showTime && timeStats.totalMs > 0 && <Pill color="blue">{formatDuration(timeStats.totalMs)}</Pill>}
            {lastActivity && <span className={styles.lastActivity}>{lastActivity}</span>}
          </div>
        </div>
      </Link>
      <Button
        size="md"
        className={styles.resumeButton}
        style={{ background: projectColorVar(project.colorKey) }}
        onClick={() => navigate(getContinueRoute(project.id, continueTarget))}
      >
        Reprendre
      </Button>
    </div>
  )
}
