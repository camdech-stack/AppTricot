import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotebookPen, Plus } from 'lucide-react'
import styles from './ProjectGuideCard.module.css'
import { IconButton, Button, ConfirmDialog } from '../ui'
import { AssociateGuideSheet } from './AssociateGuideSheet'
import { CreateGuideSheet } from '../guides/CreateGuideSheet'
import { useGuideLibraryContext } from '../../hooks/useGuideLibraryContext'
import { useGuideContents } from '../../hooks/useGuideContents'
import { useGuideProgress } from '../../hooks/useGuideProgress'
import { useProjectPatterns } from '../../hooks/useProjectPatterns'
import {
  computeGuideStats,
  getGuideProgress,
  getResumeSummary,
  linkGuideToProject,
  unlinkGuideFromProject,
  type GuideContent,
  type GuideRecord,
  type ProjectGuideRecord,
} from '../../data'

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
  const [removeConfirm, setRemoveConfirm] = useState<ProjectGuideRecord | null>(null)

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
            return (
              <GuideRow
                key={link.id}
                projectId={projectId}
                guide={guide}
                content={contents[guide.id]}
                onOpen={() => navigate(`/guides/${guide.id}`, { state: { returnTo: `/projets/${projectId}` } })}
                onResume={() => navigate(`/projets/${projectId}/guides/${guide.id}/suivre`)}
                onRemove={() => setRemoveConfirm(link)}
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

      <ConfirmDialog
        open={removeConfirm !== null}
        title="Retirer ce guide"
        message="La progression de ce guide dans ce projet sera supprimée. Le temps déjà passé et les compteurs du projet ne le sont pas."
        confirmLabel="Retirer"
        danger
        onConfirm={() => {
          if (removeConfirm) void unlinkGuideFromProject(removeConfirm.id)
          setRemoveConfirm(null)
        }}
        onCancel={() => setRemoveConfirm(null)}
      />
    </div>
  )
}

interface GuideRowProps {
  projectId: string
  guide: GuideRecord
  content: GuideContent | undefined
  onOpen: () => void
  onResume: () => void
  onRemove: () => void
}

function GuideRow({ projectId, guide, content, onOpen, onResume, onRemove }: GuideRowProps) {
  const progress = useGuideProgress(projectId, guide.id)
  const stats = content ? computeGuideStats(content) : undefined
  const rows = stats?.knownRows

  const hasStarted = Boolean(progress && Object.keys(progress.pieces).length > 0)
  const guideProgress = content && progress ? getGuideProgress(content, progress) : null
  const resumeSummary = content && progress ? getResumeSummary(content, progress) : null
  const stepLabel = resumeSummary?.description
    ? [resumeSummary.description.pieceName, resumeSummary.description.rowLabel ?? resumeSummary.description.blockLabel].filter(Boolean).join(' · ')
    : null

  const metaText =
    hasStarted && guideProgress
      ? `${guideProgress.percent} %${stepLabel ? ` · ${stepLabel}` : ''}`
      : rows != null
        ? `${rows} rang${rows > 1 ? 's' : ''}`
        : '—'

  return (
    <div className={styles.item}>
      <button type="button" className={styles.itemMain} onClick={onOpen}>
        <div className={styles.thumb}>
          <NotebookPen size={20} strokeWidth={1.75} />
        </div>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{guide.name}</span>
          <span className={styles.itemMeta}>{metaText}</span>
        </div>
      </button>
      {hasStarted && (
        <Button size="sm" variant="secondary" onClick={onResume}>
          Reprendre
        </Button>
      )}
      <button type="button" className={styles.removeButton} onClick={onRemove}>
        Retirer
      </button>
    </div>
  )
}
