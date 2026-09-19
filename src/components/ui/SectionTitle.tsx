import { Link } from 'react-router-dom'
import styles from './SectionTitle.module.css'

interface SectionTitleProps {
  title: string
  seeAllTo?: string
}

export function SectionTitle({ title, seeAllTo }: SectionTitleProps) {
  return (
    <div className={styles.row}>
      <h2 className={styles.title}>{title}</h2>
      {seeAllTo && (
        <Link to={seeAllTo} className={styles.link}>
          Voir tout
        </Link>
      )}
    </div>
  )
}
