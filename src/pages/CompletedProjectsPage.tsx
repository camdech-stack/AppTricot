import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import styles from './CompletedProjectsPage.module.css'
import { Card, IconButton } from '../components/ui'
import { useCompletedProjectsHistory } from '../hooks/useCompletedProjectsHistory'
import { useSettings } from '../hooks/useSettings'
import { formatDateFr } from '../utils/formatDate'
import { formatDuration } from '../utils/formatDuration'
import { projectColorVar } from '../components/projects/colorMeta'

export function CompletedProjectsPage() {
  const navigate = useNavigate()
  const history = useCompletedProjectsHistory()
  const settings = useSettings()
  const showTime = settings?.trackingEnabled ?? true

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={() => navigate('/stats')} />
        <h1>Projets terminés</h1>
      </div>

      {history === undefined ? null : history.length === 0 ? (
        <Card className={styles.empty}>Aucun projet terminé pour l'instant.</Card>
      ) : (
        <ul className={styles.list}>
          {history.map(({ project, totalMs }) => (
            <li key={project.id}>
              <Link to={`/projets/${project.id}`} className={styles.item} style={{ borderLeftColor: projectColorVar(project.colorKey) }}>
                <div className={styles.name}>{project.name}</div>
                <div className={styles.meta}>
                  {project.completedAt ? `Terminé le ${formatDateFr(project.completedAt)}` : 'Date de fin non renseignée'}
                  {showTime && totalMs > 0 ? ` · ${formatDuration(totalMs)}` : ''}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
