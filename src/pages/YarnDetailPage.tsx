import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import styles from './YarnDetailPage.module.css'
import layoutStyles from '../components/layout/AppLayout.module.css'
import { FloatingTabBar } from '../components/layout/FloatingTabBar'
import { IconButton, StripedProgressBar, WaveDivider } from '../components/ui'
import { YarnStockBar } from '../components/yarn/YarnStockBar'
import { AdjustStockSheet } from '../components/yarn/AdjustStockSheet'
import { LogUsageSheet } from '../components/yarn/LogUsageSheet'
import { EditUsageSheet } from '../components/yarn/EditUsageSheet'
import { COLOR_FAMILY_LABELS, WEIGHT_CATEGORY_LABELS } from '../components/yarn/yarnMeta'
import { useYarnStockContext } from '../hooks/useYarnStockContext'
import { useYarnImageUrl } from '../hooks/useYarnImageUrl'
import { useYarnUsages } from '../hooks/useYarnUsages'
import { useSettings } from '../hooks/useSettings'
import { formatDateFr } from '../utils/formatDate'
import { formatYarnAmount } from '../utils/formatYarnQuantity'
import { computeProjectYarnLinkProgress, computeYarnStockSummary, type YarnUsageRecord } from '../data'

export function YarnDetailPage() {
  const { yarnId } = useParams<{ yarnId: string }>()
  const navigate = useNavigate()
  const context = useYarnStockContext()
  const photoUrl = useYarnImageUrl(yarnId)
  const usages = useYarnUsages(yarnId)
  const settings = useSettings()
  const displayUnit = settings?.yarnQuantityUnit ?? 'weight'
  const lengthUnit = settings?.lengthUnit ?? 'm'

  const [adjustOpen, setAdjustOpen] = useState(false)
  const [logUsageOpen, setLogUsageOpen] = useState(false)
  const [editingUsage, setEditingUsage] = useState<YarnUsageRecord | null>(null)

  const yarn = context?.yarns.find((candidate) => candidate.id === yarnId)

  if (!context || !yarn || !yarnId) {
    return <div className={layoutStyles.shell} />
  }

  const stock = computeYarnStockSummary(yarn, context.usages, context.projectYarns, context.projects)
  const links = context.projectYarns.filter((link) => link.yarnId === yarnId)

  return (
    <div className={layoutStyles.shell}>
      <FloatingTabBar />
      <div className={layoutStyles.main}>
        <div className={layoutStyles.content}>
          <div
            className={photoUrl ? styles.hero : `${styles.hero} ${styles.heroFallback}`}
            style={photoUrl ? { backgroundImage: `url(${photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            <div className={styles.topBar}>
              <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" className={styles.heroIconButton} onClick={() => navigate('/laine')} />
              <button type="button" className={styles.editButton} onClick={() => navigate(`/laine/${yarnId}/modifier`)}>
                <Pencil size={18} strokeWidth={1.75} />
                Modifier
              </button>
            </div>
            <h1 className={styles.name}>{yarn.name}</h1>
            <p className={styles.subtitle}>
              {[yarn.brand, yarn.colorName].filter(Boolean).join(' · ') || 'Aucune marque'}
            </p>
          </div>
          <WaveDivider />

          <div className={styles.body}>
            <div className={styles.metaRow}>
              {yarn.weightCategory && <span className={styles.metaPill}>{WEIGHT_CATEGORY_LABELS[yarn.weightCategory]}</span>}
              {yarn.colorFamily && <span className={styles.metaPill}>{COLOR_FAMILY_LABELS[yarn.colorFamily]}</span>}
              {yarn.dyeLot && <span className={styles.metaPill}>Lot {yarn.dyeLot}</span>}
            </div>

            <YarnStockBar yarn={yarn} stock={stock} displayUnit={displayUnit} lengthUnit={lengthUnit} />

            <button type="button" className={styles.shortcutButton} onClick={() => setAdjustOpen(true)}>
              J'ai acheté / retiré des pelotes
            </button>

            {links.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2>Projets liés</h2>
                </div>
                <div className={styles.linkedList}>
                  {links.map((link) => {
                    const project = context.projects.find((candidate) => candidate.id === link.projectId)
                    if (!project) return null
                    const progress = computeProjectYarnLinkProgress(link, yarn, context.usages)
                    return (
                      <Link key={link.id} to={`/projets/${project.id}`} className={styles.linkedItem}>
                        <div className={styles.linkedItemHeader}>
                          <span>{project.name}</span>
                          <span className={styles.linkedItemQty}>
                            {formatYarnAmount(progress.consumedSkeins, 'skein', lengthUnit)} /{' '}
                            {progress.plannedSkeins !== null ? formatYarnAmount(progress.plannedSkeins, 'skein', lengthUnit) : '—'}
                          </span>
                        </div>
                        <StripedProgressBar progress={progress.ratio ?? 0} />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Historique des consommations</h2>
                <IconButton icon={<Plus strokeWidth={1.75} />} label="Enregistrer une consommation" onClick={() => setLogUsageOpen(true)} />
              </div>
              {!usages || usages.length === 0 ? (
                <p className={styles.emptyText}>Aucune consommation enregistrée.</p>
              ) : (
                <div className={styles.usageList}>
                  {usages.map((usage) => {
                    const project = usage.projectId ? context.projects.find((candidate) => candidate.id === usage.projectId) : undefined
                    return (
                      <button key={usage.id} type="button" className={styles.usageRow} onClick={() => setEditingUsage(usage)}>
                        <div>
                          <div className={styles.usageAmount}>{formatYarnAmount(usage.value, usage.unit, lengthUnit)}</div>
                          <div className={styles.usageMeta}>
                            {formatDateFr(usage.usedAt)} · {project?.name ?? 'Sans projet'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AdjustStockSheet open={adjustOpen} onClose={() => setAdjustOpen(false)} yarn={yarn} />
      <LogUsageSheet
        open={logUsageOpen}
        onClose={() => setLogUsageOpen(false)}
        yarn={yarn}
        projects={context.projects}
        lengthUnit={lengthUnit}
      />
      {editingUsage && (
        <EditUsageSheet open onClose={() => setEditingUsage(null)} usage={editingUsage} lengthUnit={lengthUnit} />
      )}
    </div>
  )
}
