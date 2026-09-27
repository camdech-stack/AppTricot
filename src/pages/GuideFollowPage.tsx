import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './GuideFollowPage.module.css'
import { GuideStartScreen } from '../components/guides/follow/GuideStartScreen'
import { GuideFollowScreen } from '../components/guides/follow/GuideFollowScreen'
import { useProject } from '../hooks/useProject'
import { useGuide } from '../hooks/useGuide'
import { useGuideContent } from '../hooks/useGuideContent'
import { useGuideProgress } from '../hooks/useGuideProgress'
import { useWakeLock } from '../hooks/useWakeLock'
import { startGuide } from '../data'

// /projets/:projectId/guides/:guideId/suivre — no FloatingTabBar, screen
// kept on. Always lands on the summary screen first, whether the guide is
// fresh or mid-progress (see CLAUDE.md "Écran de départ") — opening this
// route never starts anything by itself, only "Commencer"/"Reprendre" does.
export function GuideFollowPage() {
  const { projectId, guideId } = useParams<{ projectId: string; guideId: string }>()
  const navigate = useNavigate()

  const project = useProject(projectId)
  const guide = useGuide(guideId)
  const content = useGuideContent(guideId)
  const progress = useGuideProgress(projectId, guideId)

  useWakeLock(true)

  const [mode, setMode] = useState<'summary' | 'active'>('summary')
  useEffect(() => {
    setMode('summary')
  }, [projectId, guideId])

  if (!projectId || !guideId) return <div className={styles.page} />

  function goToProject() {
    navigate(`/projets/${projectId}`)
  }

  if (!project || !guide || !content) {
    return <div className={styles.page} />
  }

  if (mode === 'active' && progress) {
    return (
      <div className={styles.page}>
        <GuideFollowScreen projectId={projectId} guideId={guideId} project={project} content={content} progress={progress} onBack={goToProject} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <GuideStartScreen
        guideName={guide.name}
        content={content}
        progress={progress}
        onBack={goToProject}
        onStart={() => {
          void startGuide(projectId, guideId).then(() => setMode('active'))
        }}
      />
    </div>
  )
}
