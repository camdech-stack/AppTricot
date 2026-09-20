import { useLiveQuery } from 'dexie-react-hooks'
import { getProjectPatterns, type ProjectPatternRecord } from '../data'

export function useProjectPatterns(projectId: string): ProjectPatternRecord[] | undefined {
  return useLiveQuery(() => getProjectPatterns(projectId), [projectId])
}
