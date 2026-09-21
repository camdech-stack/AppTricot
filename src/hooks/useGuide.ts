import { useLiveQuery } from 'dexie-react-hooks'
import { getGuide, type GuideRecord } from '../data'

export function useGuide(id: string | undefined): GuideRecord | undefined {
  return useLiveQuery(() => (id ? getGuide(id) : undefined), [id])
}
