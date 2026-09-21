import { useEffect, useState } from 'react'
import { getGuideContent, type GuideContent, type GuideRecord } from '../data'

// A stable reference for "no guides yet" — a fresh `[]` literal on every
// render (e.g. a `?? []` fallback while a query is still loading) would
// retrigger the effect below every render, which resolves immediately and
// re-renders again: an infinite loop that never lets the query settle.
const NO_GUIDES: GuideRecord[] = []

// Guide contents live in their own table (see CLAUDE.md "Modèle de données
// étape 5a"), so anywhere that just needs stats (row/piece counts) loads
// them once here instead of through a liveQuery. `guides` should come
// straight from useLiveQuery, which keeps a stable reference between
// renders until the underlying data actually changes, so this only
// re-fetches then.
export function useGuideContents(guides: GuideRecord[] = NO_GUIDES): Record<string, GuideContent> {
  const [contents, setContents] = useState<Record<string, GuideContent>>({})

  useEffect(() => {
    let cancelled = false
    void Promise.all(guides.map(async (guide) => [guide.id, await getGuideContent(guide.id)] as const)).then((entries) => {
      if (cancelled) return
      const next: Record<string, GuideContent> = {}
      for (const [id, content] of entries) {
        if (content) next[id] = content
      }
      setContents(next)
    })
    return () => {
      cancelled = true
    }
  }, [guides])

  return contents
}
