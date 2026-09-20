import { useLiveQuery } from 'dexie-react-hooks'
import { getProjectYarns, type ProjectYarnRecord } from '../data'

export function useProjectYarns(projectId: string | undefined): ProjectYarnRecord[] | undefined {
  return useLiveQuery(() => (projectId ? getProjectYarns(projectId) : []), [projectId])
}
