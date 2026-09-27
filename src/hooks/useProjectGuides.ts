import { useLiveQuery } from 'dexie-react-hooks'
import { getProjectGuides, type ProjectGuideRecord } from '../data'

export function useProjectGuides(projectId: string): ProjectGuideRecord[] | undefined {
  return useLiveQuery(() => getProjectGuides(projectId), [projectId])
}
