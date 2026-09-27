import { useEffect, useState } from 'react'
import { GuideStartScreen } from './GuideStartScreen'
import { GuideFollowScreen } from './GuideFollowScreen'
import { useGuide } from '../../../hooks/useGuide'
import { useGuideContent } from '../../../hooks/useGuideContent'
import { useGuideProgress } from '../../../hooks/useGuideProgress'
import { useProject } from '../../../hooks/useProject'
import { startGuide } from '../../../data'

interface GuidePanelProps {
  projectId: string
  guideId: string
  // Omitted when embedded in a page that already has its own back button
  // (the project work view's "Guide" tab) — the full-page follow route
  // passes one to return to the project (see CLAUDE.md "Vue de travail").
  onBack?: () => void
}

// Always lands on the summary screen first, whether the guide is fresh or
// mid-progress (see CLAUDE.md "Écran de départ") — opening it never starts
// anything by itself, only "Commencer"/"Reprendre" does. Shared by the
// full-page follow route (GuideFollowPage) and the project work view's
// "Guide" tab, exactly like CounterPanel is shared by the counter screen
// and the work view's "Compteur" tab.
export function GuidePanel({ projectId, guideId, onBack }: GuidePanelProps) {
  const project = useProject(projectId)
  const guide = useGuide(guideId)
  const content = useGuideContent(guideId)
  const progress = useGuideProgress(projectId, guideId)

  const [mode, setMode] = useState<'summary' | 'active'>('summary')
  useEffect(() => {
    setMode('summary')
  }, [projectId, guideId])

  if (!project || !guide || !content) return null

  if (mode === 'active' && progress) {
    return (
      <GuideFollowScreen projectId={projectId} guideId={guideId} project={project} content={content} progress={progress} onBack={onBack} />
    )
  }

  return (
    <GuideStartScreen
      guideName={guide.name}
      content={content}
      progress={progress}
      onBack={onBack}
      onStart={() => {
        void startGuide(projectId, guideId).then(() => setMode('active'))
      }}
    />
  )
}
