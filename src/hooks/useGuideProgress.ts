import { useLiveQuery } from 'dexie-react-hooks'
import { getProgress, type GuideProgressRecord } from '../data'

export function useGuideProgress(projectId: string | undefined, guideId: string | undefined): GuideProgressRecord | undefined {
  return useLiveQuery(() => (projectId && guideId ? getProgress(projectId, guideId) : undefined), [projectId, guideId])
}
