import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import styles from './PageHeader.module.css'
import { WaveDivider } from './WaveDivider'
import { IconButton } from './IconButton'

interface PageHeaderProps {
  title: string
  onBack?: () => void
  action?: ReactNode
  colored?: boolean
}

export function PageHeader({ title, onBack, action, colored = false }: PageHeaderProps) {
  return (
    <div className={colored ? styles.wrapColored : styles.wrap}>
      <div className={styles.bar}>
        {onBack && (
          <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={onBack} className={styles.back} />
        )}
        <h1 className={styles.title}>{title}</h1>
        {action && <div className={styles.action}>{action}</div>}
      </div>
      {colored && <WaveDivider />}
    </div>
  )
}
