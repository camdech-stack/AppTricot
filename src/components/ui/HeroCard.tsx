import type { HTMLAttributes } from 'react'
import styles from './HeroCard.module.css'

export function HeroCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.hero, className].filter(Boolean).join(' ')} {...props} />
}
