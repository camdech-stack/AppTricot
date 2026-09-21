import { useLiveQuery } from 'dexie-react-hooks'
import { getAllProjectGuides, getGuides, getPatterns, getProjects, type GuideRecord, type PatternRecord, type ProjectGuideRecord, type ProjectRecord } from '../data'

export interface GuideLibraryContext {
  guides: GuideRecord[]
  projectGuides: ProjectGuideRecord[]
  patterns: PatternRecord[]
  projects: ProjectRecord[]
}

// Everything the guide list/cards need across the whole app — same
// reasoning as usePatternLibraryContext (a guide card shows its linked
// pattern's name and every linked project).
export function useGuideLibraryContext(): GuideLibraryContext | undefined {
  return useLiveQuery(async () => {
    const [guides, projectGuides, patterns, projects] = await Promise.all([getGuides(), getAllProjectGuides(), getPatterns(), getProjects()])
    return { guides, projectGuides, patterns, projects }
  }, [])
}
