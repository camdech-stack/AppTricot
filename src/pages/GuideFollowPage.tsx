import { useNavigate, useParams } from 'react-router-dom'
import styles from './GuideFollowPage.module.css'
import { GuidePanel } from '../components/guides/follow/GuidePanel'
import { useWakeLock } from '../hooks/useWakeLock'

// /projets/:projectId/guides/:guideId/suivre — no FloatingTabBar, screen
// kept on. See GuidePanel for the summary/active mode switch shared with
// the project work view's "Guide" tab.
export function GuideFollowPage() {
  const { projectId, guideId } = useParams<{ projectId: string; guideId: string }>()
  const navigate = useNavigate()

  useWakeLock(true)

  if (!projectId || !guideId) return <div className={styles.page} />

  return (
    <div className={styles.page}>
      <GuidePanel projectId={projectId} guideId={guideId} onBack={() => navigate(`/projets/${projectId}`)} />
    </div>
  )
}
