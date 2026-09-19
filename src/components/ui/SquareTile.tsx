import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './SquareTile.module.css'

interface SquareTileProps {
  to: string
  icon: ReactNode
  label: string
}

// Square icon-style shortcut, meant for a future "Outils" grid on the
// home page (counter, and later others) — deliberately not a full-width
// button.
export function SquareTile({ to, icon, label }: SquareTileProps) {
  return (
    <Link to={to} className={styles.tile}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
    </Link>
  )
}
