import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import styles from './PatternCard.module.css'
import { Pill } from '../ui'
import { usePatternCoverUrl } from '../../hooks/usePatternCoverUrl'
import { usePatternViewState } from '../../hooks/usePatternViewState'
import { useRelativeTime } from '../../hooks/useRelativeTime'
import type { PatternRecord } from '../../data'

interface PatternCardProps {
  pattern: PatternRecord
}

export function PatternCard({ pattern }: PatternCardProps) {
  const coverUrl = usePatternCoverUrl(pattern.id)
  const libraryState = usePatternViewState(pattern.id, null)
  const lastOpened = useRelativeTime(pattern.lastOpenedAt ?? undefined)

  const progressLabel =
    libraryState && libraryState.page > 1
      ? `Page ${libraryState.page} / ${pattern.pageCount}`
      : lastOpened
        ? `Ouvert il y a ${lastOpened}`
        : null

  return (
    <Link to={`/patrons/${pattern.id}`} className={styles.card}>
      <div className={coverUrl ? styles.cover : `${styles.cover} ${styles.coverFallback}`} style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}>
        {!coverUrl && <BookOpen size={32} strokeWidth={1.5} />}
      </div>

      <div className={styles.overlay}>
        <div className={styles.name}>{pattern.name}</div>
        <div className={styles.meta}>
          {pattern.pageCount} page{pattern.pageCount > 1 ? 's' : ''}
          {progressLabel ? ` · ${progressLabel}` : ''}
        </div>
        {pattern.tags.length > 0 && (
          <div className={styles.tags}>
            {pattern.tags.slice(0, 3).map((tag) => (
              <Pill key={tag} color="blue" className={styles.tagPill}>
                {tag}
              </Pill>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
