import { lazy, Suspense } from 'react'

// Dynamically imported for the same reason as LazyGuideFollowPage/
// LazyGuideEditorPage: never joins the main bundle.
const GuidePreviewPage = lazy(() => import('./GuidePreviewPage').then((module) => ({ default: module.GuidePreviewPage })))

export function LazyGuidePreviewPage() {
  return (
    <Suspense fallback={null}>
      <GuidePreviewPage />
    </Suspense>
  )
}
