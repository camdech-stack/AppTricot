import { useLiveQuery } from 'dexie-react-hooks'
import { getPatternViewState, type PatternViewStateRecord } from '../data'

export function usePatternViewState(patternId: string | undefined, projectId: string | null): PatternViewStateRecord | undefined {
  return useLiveQuery(() => (patternId ? getPatternViewState(patternId, projectId) : undefined), [patternId, projectId])
}
