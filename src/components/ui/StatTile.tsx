import type { ReactNode } from 'react'
import styles from './StatTile.module.css'
import type { PillColor } from './Pill'

interface StatTileProps {
  icon: ReactNode
  value: ReactNode
  label: string
  color?: PillColor
}

export function StatTile({ icon, value, label, color = 'primary' }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={[styles.iconWrap, styles[color]].join(' ')}>{icon}</span>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
