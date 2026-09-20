import { Link } from 'react-router-dom'
import styles from './YarnCard.module.css'
import patterns from '../../styles/patterns.module.css'
import { StripedProgressBar } from '../ui'
import { useYarnImageUrl } from '../../hooks/useYarnImageUrl'
import { useSettings } from '../../hooks/useSettings'
import { formatYarnQuantity } from '../../utils/formatYarnQuantity'
import type { YarnRecord } from '../../data'
import type { YarnStockSummary } from '../../data'

interface YarnCardProps {
  yarn: YarnRecord
  stock: YarnStockSummary
}

export function YarnCard({ yarn, stock }: YarnCardProps) {
  const coverUrl = useYarnImageUrl(yarn.id)
  const settings = useSettings()

  const remainingLabel = formatYarnQuantity(
    stock.remainingSkeins,
    yarn,
    settings?.yarnQuantityUnit ?? 'weight',
    settings?.lengthUnit ?? 'm',
  )

  return (
    <Link to={`/laine/${yarn.id}`} className={styles.card}>
      <div
        className={coverUrl ? styles.thumb : `${styles.thumb} ${patterns.stripes}`}
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      />
      <div className={styles.info}>
        <div className={styles.name}>{yarn.name}</div>
        <div className={styles.meta}>{[yarn.brand, yarn.colorName].filter(Boolean).join(' · ') || '—'}</div>
        <div className={styles.remaining}>{remainingLabel}</div>
        <StripedProgressBar progress={stock.consumedRatio ?? 0} label="Consommation" />
      </div>
    </Link>
  )
}
