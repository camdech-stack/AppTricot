import { lazy, Suspense } from 'react'

// Dynamically imported so the follow screen never lands in the main bundle
// — same convention as the guide editor (LazyGuideEditorPage.tsx).
const GuideFollowPage = lazy(() => import('./GuideFollowPage').then((module) => ({ default: module.GuideFollowPage })))

export function LazyGuideFollowPage() {
  return (
    <Suspense fallback={null}>
      <GuideFollowPage />
    </Suspense>
  )
}
