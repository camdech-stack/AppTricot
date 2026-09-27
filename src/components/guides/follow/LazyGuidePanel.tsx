import { lazy, Suspense } from 'react'

// Dynamically imported so the guide follow UI — which pulls in the guide
// editor's own RowsScreen/dnd-kit code via "Corriger" (CorrectStepSheet) —
// never joins the main bundle just because ProjectWorkPage (not itself
// lazy) statically renders it. Same convention as LazyGuideEditorPage.
const GuidePanel = lazy(() => import('./GuidePanel').then((module) => ({ default: module.GuidePanel })))

interface LazyGuidePanelProps {
  projectId: string
  guideId: string
  onBack?: () => void
}

export function LazyGuidePanel(props: LazyGuidePanelProps) {
  return (
    <Suspense fallback={null}>
      <GuidePanel {...props} />
    </Suspense>
  )
}
