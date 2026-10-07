import { useLiveQuery } from 'dexie-react-hooks'
import { getCompletedProjectsHistory, type CompletedProjectEntry } from '../data'

export function useCompletedProjectsHistory(): CompletedProjectEntry[] | undefined {
  return useLiveQuery(() => getCompletedProjectsHistory(), [])
}
