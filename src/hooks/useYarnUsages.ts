import { useLiveQuery } from 'dexie-react-hooks'
import { getYarnUsages, type YarnUsageRecord } from '../data'

export function useYarnUsages(yarnId: string | undefined): YarnUsageRecord[] | undefined {
  return useLiveQuery(() => (yarnId ? getYarnUsages(yarnId) : []), [yarnId])
}
