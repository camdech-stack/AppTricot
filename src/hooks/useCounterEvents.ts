import { useLiveQuery } from 'dexie-react-hooks'
import { getCounterEvents, type CounterEventRecord } from '../data'

export function useCounterEvents(counterId: string | undefined): CounterEventRecord[] | undefined {
  return useLiveQuery(() => (counterId ? getCounterEvents(counterId) : []), [counterId])
}
