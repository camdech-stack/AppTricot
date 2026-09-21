import { lazy, Suspense } from 'react'

// Dynamically imported so the guide editor (dnd-kit + the whole tree UI)
// never lands in the main bundle — see CLAUDE.md "Charge l'éditeur en
// import dynamique", same convention as pdf.js in src/pdf/pdfjs.ts.
const GuideEditorPage = lazy(() => import('./GuideEditorPage').then((module) => ({ default: module.GuideEditorPage })))

export function LazyGuideEditorPage() {
  return (
    <Suspense fallback={null}>
      <GuideEditorPage />
    </Suspense>
  )
}
