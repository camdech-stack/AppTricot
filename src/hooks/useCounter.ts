import { useLiveQuery } from 'dexie-react-hooks'
import { getCounter, type CounterRecord } from '../data'

export function useCounter(id: string | undefined): CounterRecord | undefined {
  return useLiveQuery(() => (id ? getCounter(id) : undefined), [id])
}
