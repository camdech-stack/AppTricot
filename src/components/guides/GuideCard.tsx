import { Link } from 'react-router-dom'
import { NotebookText, PlayCircle } from 'lucide-react'
import styles from './GuideCard.module.css'
import { CRAFT_LABELS } from '../projects/statusMeta'
import { useGuideProjectsProgress } from '../../hooks/useGuideProjectsProgress'
import { getGuideProgress, type GuideContent, type GuideRecord, type PatternRecord, type ProjectRecord, computeGuideStats } from '../../data'

interface GuideCardProps {
  guide: GuideRecord
  content: GuideContent | undefined
  pattern: PatternRecord | undefined
  linkedProjects: ProjectRecord[]
  onFollow: () => void
}

export function GuideCard({ guide, content, pattern, linkedProjects, onFollow }: GuideCardProps) {
  const stats = content ? computeGuideStats(content) : undefined
  const projectsProgress = useGuideProjectsProgress(guide.id)

  const statsLabel = stats
    ? `${stats.pieceCount} pièce${stats.pieceCount > 1 ? 's' : ''} · ${stats.knownRows}${stats.hasVariableLength ? '+' : ''} rang${stats.knownRows > 1 ? 's' : ''}`
    : '—'

  const metaParts = [guide.craft ? CRAFT_LABELS[guide.craft] : null, pattern ? pattern.name : 'Aucun patron lié'].filter(Boolean)

  // A single linked project gets its own percentage; several linked
  // projects just get a count (no room for a per-project breakdown here —
  // see the project's own "Guide de patron" card for that detail).
  const singleProject = linkedProjects.length === 1 ? linkedProjects[0] : undefined
  const singleProjectProgress =
    singleProject && content && projectsProgress?.[singleProject.id] ? getGuideProgress(content, projectsProgress[singleProject.id]!) : null

  return (
    <div className={styles.card}>
      <Link to={`/guides/${guide.id}`} state={{ returnTo: '/patrons?vue=guides' }} className={styles.cardLink}>
        <div className={styles.thumb}>
          <NotebookText size={28} strokeWidth={1.75} />
        </div>
        <div className={styles.info}>
          <div className={styles.name}>{guide.name}</div>
          <div className={styles.meta}>{metaParts.join(' · ')}</div>
          <div className={styles.stats}>{statsLabel}</div>
          {linkedProjects.length > 0 && (
            <div className={styles.projects}>
              {singleProject
                ? `${singleProject.name}${singleProjectProgress ? ` · ${singleProjectProgress.percent} %` : ''}`
                : `${linkedProjects.length} projets liés`}
            </div>
          )}
        </div>
      </Link>
      <button type="button" className={styles.followButton} aria-label="Suivre ce guide" onClick={onFollow}>
        <PlayCircle size={24} strokeWidth={1.75} />
      </button>
    </div>
  )
}
