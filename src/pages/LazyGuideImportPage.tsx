import { lazy, Suspense } from 'react'

// Dynamically imported for the same reason as LazyGuideFollowPage/
// LazyGuideEditorPage: never joins the main bundle.
const GuideImportPage = lazy(() => import('./GuideImportPage').then((module) => ({ default: module.GuideImportPage })))

export function LazyGuideImportPage() {
  return (
    <Suspense fallback={null}>
      <GuideImportPage />
    </Suspense>
  )
}
