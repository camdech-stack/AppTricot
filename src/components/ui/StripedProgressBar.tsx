import styles from './StripedProgressBar.module.css'
import patterns from '../../styles/patterns.module.css'
import type { ProjectColorKey } from '../../data/types'

export type ProjectColor = ProjectColorKey

const PROJECT_STRIPE_CLASS: Record<ProjectColor, string | undefined> = {
  prune: patterns.stripesProjectPrune,
  pervenche: patterns.stripesProjectPervenche,
  terracotta: patterns.stripesProjectTerracotta,
  peche: patterns.stripesProjectPeche,
  rouge: patterns.stripesProjectRouge,
  rose: patterns.stripesProjectRose,
}

interface StripedProgressBarProps {
  progress: number // 0 to 1
  projectColor?: ProjectColor
  label?: string
}

export function StripedProgressBar({ progress, projectColor = 'prune', label }: StripedProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress))

  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={[styles.fill, patterns.stripes, PROJECT_STRIPE_CLASS[projectColor]].join(' ')}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
