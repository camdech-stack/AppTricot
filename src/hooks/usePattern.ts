import { useLiveQuery } from 'dexie-react-hooks'
import { getPattern, type PatternRecord } from '../data'

export function usePattern(id: string | undefined): PatternRecord | undefined {
  return useLiveQuery(() => (id ? getPattern(id) : undefined), [id])
}
