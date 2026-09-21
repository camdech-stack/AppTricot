import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotebookPen, Plus } from 'lucide-react'
import styles from './ProjectGuideCard.module.css'
import { IconButton } from '../ui'
import { AssociateGuideSheet } from './AssociateGuideSheet'
import { CreateGuideSheet } from '../guides/CreateGuideSheet'
import { useGuideLibraryContext } from '../../hooks/useGuideLibraryContext'
import { useGuideContents } from '../../hooks/useGuideContents'
import { useProjectPatterns } from '../../hooks/useProjectPatterns'
import { computeGuideStats, linkGuideToProject, unlinkGuideFromProject, type GuideRecord, type ProjectGuideRecord } from '../../data'

interface ProjectGuideCardProps {
  projectId: string
}

export function ProjectGuideCard({ projectId }: ProjectGuideCardProps) {
  const navigate = useNavigate()
  const context = useGuideLibraryContext()
  const patternLinks = useProjectPatterns(projectId)
  const contents = useGuideContents(context?.guides)
  const [associateOpen, setAssociateOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  if (!context) return null

  const project = context.projects.find((candidate) => candidate.id === projectId)
  const links = context.projectGuides.filter((link) => link.projectId === projectId).sort((a, b) => a.position - b.position)
  const candidates = context.guides.filter((guide) => !links.some((link) => link.guideId === guide.id))
  const firstLinkedPatternId = (patternLinks ?? []).slice().sort((a, b) => a.position - b.position)[0]?.patternId ?? null

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2>Guide de patron</h2>
        <div className={styles.headerActions}>
          <IconButton icon={<NotebookPen strokeWidth={1.75} />} label="Créer un guide" onClick={() => setCreateOpen(true)} />
          <IconButton icon={<Plus strokeWidth={1.75} />} label="Associer un guide" onClick={() => setAssociateOpen(true)} />
        </div>
      </div>

      {links.length === 0 ? (
        <p className={styles.emptyText}>Aucun guide associé à ce projet.</p>
      ) : (
        <div className={styles.list}>
          {links.map((link) => {
            const guide = context.guides.find((candidate) => candidate.id === link.guideId)
            if (!guide) return null
            const content = contents[guide.id]
            const rows = content ? computeGuideStats(content).knownRows : undefined
            return (
              <GuideRow
                key={link.id}
                link={link}
                guide={guide}
                rows={rows}
                onOpen={() => navigate(`/guides/${guide.id}`, { state: { returnTo: `/projets/${projectId}` } })}
                onRemove={() => void unlinkGuideFromProject(link.id)}
              />
            )
          })}
        </div>
      )}

      <AssociateGuideSheet open={associateOpen} onClose={() => setAssociateOpen(false)} projectId={projectId} candidates={candidates} />

      <CreateGuideSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(guide) => {
          setCreateOpen(false)
          void linkGuideToProject(projectId, guide.id).then(() =>
            navigate(`/guides/${guide.id}`, { state: { returnTo: `/projets/${projectId}` } }),
          )
        }}
        patterns={context.patterns}
        defaultCraft={project?.craft ?? null}
        defaultPatternId={firstLinkedPatternId}
      />
    </div>
  )
}

interface GuideRowProps {
  link: ProjectGuideRecord
  guide: GuideRecord
  rows: number | undefined
  onOpen: () => void
  onRemove: () => void
}

function GuideRow({ guide, rows, onOpen, onRemove }: GuideRowProps) {
  return (
    <div className={styles.item}>
      <button type="button" className={styles.itemMain} onClick={onOpen}>
        <div className={styles.thumb}>
          <NotebookPen size={20} strokeWidth={1.75} />
        </div>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{guide.name}</span>
          <span className={styles.itemMeta}>{rows != null ? `${rows} rang${rows > 1 ? 's' : ''}` : '—'}</span>
        </div>
      </button>
      <button type="button" className={styles.removeButton} onClick={onRemove}>
        Retirer
      </button>
    </div>
  )
}
