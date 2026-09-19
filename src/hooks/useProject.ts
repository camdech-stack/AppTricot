import { useLiveQuery } from 'dexie-react-hooks'
import { getProject, type ProjectRecord } from '../data'

export function useProject(id: string | undefined): ProjectRecord | undefined {
  return useLiveQuery(() => (id ? getProject(id) : undefined), [id])
}
