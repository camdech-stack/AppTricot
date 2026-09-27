import { useLiveQuery } from 'dexie-react-hooks'
import { getProjectGuideProgressInputs, type ProgressGuideInput } from '../data'

// Feeds computeProjectProgress (progress.ts) — step 5b's guide-based
// progress takes over from the counter-based fallback as soon as any
// linked guide has a known step (see CLAUDE.md "Modèle de données").
export function useProjectGuideProgressInputs(projectId: string | undefined): ProgressGuideInput[] | undefined {
  return useLiveQuery(() => (projectId ? getProjectGuideProgressInputs(projectId) : undefined), [projectId])
}
