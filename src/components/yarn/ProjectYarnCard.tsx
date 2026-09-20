import { useState } from 'react'
import { Plus } from 'lucide-react'
import styles from './ProjectYarnCard.module.css'
import { Button, IconButton, StripedProgressBar } from '../ui'
import { LinkYarnSheet } from './LinkYarnSheet'
import { LogUsageSheet } from './LogUsageSheet'
import { useYarnStockContext } from '../../hooks/useYarnStockContext'
import { useSettings } from '../../hooks/useSettings'
import { formatYarnAmount } from '../../utils/formatYarnQuantity'
import { checkProjectYarnAvailability, computeProjectYarnLinkProgress, type ProjectYarnRecord } from '../../data'

interface ProjectYarnCardProps {
  projectId: string
}

export function ProjectYarnCard({ projectId }: ProjectYarnCardProps) {
  const context = useYarnStockContext()
  const settings = useSettings()
  const lengthUnit = settings?.lengthUnit ?? 'm'

  const [addOpen, setAddOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<ProjectYarnRecord | null>(null)
  const [logUsageOpen, setLogUsageOpen] = useState(false)

  if (!context) return null

  const project = context.projects.find((candidate) => candidate.id === projectId)
  const links = context.projectYarns.filter((link) => link.projectId === projectId)

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2>Laine</h2>
        <IconButton icon={<Plus strokeWidth={1.75} />} label="Ajouter un fil" onClick={() => setAddOpen(true)} />
      </div>

      {links.length === 0 ? (
        <p className={styles.emptyText}>Aucun fil lié à ce projet.</p>
      ) : (
        <div className={styles.list}>
          {links.map((link) => {
            const yarn = context.yarns.find((candidate) => candidate.id === link.yarnId)
            if (!yarn) return null
            const progress = computeProjectYarnLinkProgress(link, yarn, context.usages)
            const availability = checkProjectYarnAvailability(link, yarn, context.usages, context.projectYarns, context.projects)
            return (
              <button key={link.id} type="button" className={styles.item} onClick={() => setEditingLink(link)}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{yarn.name}</span>
                  <span className={styles.itemQty}>
                    {formatYarnAmount(progress.consumedSkeins, 'skein', lengthUnit)} /{' '}
                    {progress.plannedSkeins !== null ? formatYarnAmount(progress.plannedSkeins, 'skein', lengthUnit) : '—'}
                  </span>
                </div>
                <StripedProgressBar progress={progress.ratio ?? 0} />
                {availability.status !== 'unknown' && (
                  <div className={styles.availabilityRow}>
                    {availability.status === 'ok' ? (
                      <span className={styles.pillOk}>✓ Stock suffisant</span>
                    ) : (
                      <span className={styles.pillMissing}>
                        ⚠ {availability.missingValue !== null && availability.missingUnit
                          ? formatYarnAmount(availability.missingValue, availability.missingUnit, lengthUnit)
                          : ''}{' '}
                        manquants
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {links.length > 0 && (
        <Button variant="secondary" className={styles.logUsageButton} onClick={() => setLogUsageOpen(true)}>
          Enregistrer une consommation
        </Button>
      )}

      <LinkYarnSheet open={addOpen} onClose={() => setAddOpen(false)} projectId={projectId} yarns={context.yarns} lengthUnit={lengthUnit} />
      {editingLink && (
        <LinkYarnSheet
          open
          onClose={() => setEditingLink(null)}
          projectId={projectId}
          yarns={context.yarns}
          lengthUnit={lengthUnit}
          editingLink={editingLink}
        />
      )}
      {project && links.length > 0 && (
        <LogUsageSheet
          open={logUsageOpen}
          onClose={() => setLogUsageOpen(false)}
          project={project}
          pickableYarns={links.map((link) => context.yarns.find((yarn) => yarn.id === link.yarnId)).filter((yarn): yarn is NonNullable<typeof yarn> => Boolean(yarn))}
          lengthUnit={lengthUnit}
        />
      )}
    </div>
  )
}
