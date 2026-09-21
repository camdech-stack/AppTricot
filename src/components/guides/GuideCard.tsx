import { Link } from 'react-router-dom'
import { NotebookText } from 'lucide-react'
import styles from './GuideCard.module.css'
import { CRAFT_LABELS } from '../projects/statusMeta'
import { computeGuideStats, type GuideContent, type GuideRecord, type PatternRecord, type ProjectRecord } from '../../data'

interface GuideCardProps {
  guide: GuideRecord
  content: GuideContent | undefined
  pattern: PatternRecord | undefined
  linkedProjects: ProjectRecord[]
}

export function GuideCard({ guide, content, pattern, linkedProjects }: GuideCardProps) {
  const stats = content ? computeGuideStats(content) : undefined

  const statsLabel = stats
    ? `${stats.pieceCount} pièce${stats.pieceCount > 1 ? 's' : ''} · ${stats.knownRows}${stats.hasVariableLength ? '+' : ''} rang${stats.knownRows > 1 ? 's' : ''}`
    : '—'

  const metaParts = [guide.craft ? CRAFT_LABELS[guide.craft] : null, pattern ? pattern.name : 'Aucun patron lié'].filter(Boolean)

  return (
    <Link to={`/guides/${guide.id}`} className={styles.card}>
      <div className={styles.thumb}>
        <NotebookText size={28} strokeWidth={1.75} />
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{guide.name}</div>
        <div className={styles.meta}>{metaParts.join(' · ')}</div>
        <div className={styles.stats}>{statsLabel}</div>
        {linkedProjects.length > 0 && (
          <div className={styles.projects}>
            {linkedProjects.length === 1 ? linkedProjects[0]!.name : `${linkedProjects.length} projets liés`}
          </div>
        )}
      </div>
    </Link>
  )
}
