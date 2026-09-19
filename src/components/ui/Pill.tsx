import type { HTMLAttributes } from 'react'
import styles from './Pill.module.css'

export type PillColor = 'primary' | 'terracotta' | 'gold' | 'blue' | 'sage' | 'danger'

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  color?: PillColor
}

export function Pill({ color = 'primary', className, ...props }: PillProps) {
  return <span className={[styles.pill, styles[color], className].filter(Boolean).join(' ')} {...props} />
}
