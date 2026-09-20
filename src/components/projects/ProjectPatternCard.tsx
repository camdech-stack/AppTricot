import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import styles from './ProjectPatternCard.module.css'
import { IconButton } from '../ui'
import { AssociatePatternSheet } from './AssociatePatternSheet'
import { usePatternLibraryContext } from '../../hooks/usePatternLibraryContext'
import { usePatternCoverUrl } from '../../hooks/usePatternCoverUrl'
import { unlinkPatternFromProject, type PatternRecord, type ProjectPatternRecord } from '../../data'

interface ProjectPatternCardProps {
  projectId: string
}

export function ProjectPatternCard({ projectId }: ProjectPatternCardProps) {
  const context = usePatternLibraryContext()
  const navigate = useNavigate()
  const [associateOpen, setAssociateOpen] = useState(false)

  if (!context) return null

  const links = context.projectPatterns.filter((link) => link.projectId === projectId).sort((a, b) => a.position - b.position)
  const candidates = context.patterns.filter((pattern) => !links.some((link) => link.patternId === pattern.id))

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2>Patron</h2>
        <IconButton icon={<Plus strokeWidth={1.75} />} label="Associer un patron" onClick={() => setAssociateOpen(true)} />
      </div>

      {links.length === 0 ? (
        <p className={styles.emptyText}>Aucun patron associé à ce projet.</p>
      ) : (
        <div className={styles.list}>
          {links.map((link) => {
            const pattern = context.patterns.find((candidate) => candidate.id === link.patternId)
            if (!pattern) return null
            return (
              <PatternRow
                key={link.id}
                link={link}
                pattern={pattern}
                onOpen={() => navigate(`/patrons/${pattern.id}/lire?projet=${projectId}`)}
                onRemove={() => void unlinkPatternFromProject(link.id)}
              />
            )
          })}
        </div>
      )}

      <AssociatePatternSheet open={associateOpen} onClose={() => setAssociateOpen(false)} projectId={projectId} candidates={candidates} />
    </div>
  )
}

interface PatternRowProps {
  link: ProjectPatternRecord
  pattern: PatternRecord
  onOpen: () => void
  onRemove: () => void
}

function PatternRow({ pattern, onOpen, onRemove }: PatternRowProps) {
  const coverUrl = usePatternCoverUrl(pattern.id)

  return (
    <div className={styles.item}>
      <button type="button" className={styles.itemMain} onClick={onOpen}>
        <div className={styles.thumb} style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined} />
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{pattern.name}</span>
          <span className={styles.itemMeta}>{pattern.pageCount} pages</span>
        </div>
      </button>
      <button type="button" className={styles.removeButton} onClick={onRemove}>
        Retirer
      </button>
    </div>
  )
}
