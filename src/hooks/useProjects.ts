import { useLiveQuery } from 'dexie-react-hooks'
import { getProjects, type ProjectRecord } from '../data'

export function useProjects(): ProjectRecord[] | undefined {
  return useLiveQuery(() => getProjects(), [])
}
