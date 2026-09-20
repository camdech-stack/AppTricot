import { useLiveQuery } from 'dexie-react-hooks'
import { getAllProjectPatterns, getPatterns, getProjects, type PatternRecord, type ProjectPatternRecord, type ProjectRecord } from '../data'

export interface PatternLibraryContext {
  patterns: PatternRecord[]
  projectPatterns: ProjectPatternRecord[]
  projects: ProjectRecord[]
}

// Everything the library list/filters need across the whole app: which
// projects each pattern links to depends on the full projectPatterns table,
// not just one pattern's own rows — same reasoning as useYarnStockContext.
export function usePatternLibraryContext(): PatternLibraryContext | undefined {
  return useLiveQuery(async () => {
    const [patterns, projectPatterns, projects] = await Promise.all([getPatterns(), getAllProjectPatterns(), getProjects()])
    return { patterns, projectPatterns, projects }
  }, [])
}
