import styles from './PagePlaceholder.module.css'

interface PagePlaceholderProps {
  title: string
  description: string
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className={styles.page}>
      <span className={styles.badge}>À venir</span>
      <h1>{title}</h1>
      <p className={styles.description}>{description}</p>
    </div>
  )
}
