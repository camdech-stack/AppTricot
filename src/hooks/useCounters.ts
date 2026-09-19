import { useLiveQuery } from 'dexie-react-hooks'
import { getCounters, type CounterRecord } from '../data'

export function useCounters(projectId: string | null): CounterRecord[] | undefined {
  return useLiveQuery(() => getCounters(projectId), [projectId])
}
