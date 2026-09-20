import { useLiveQuery } from 'dexie-react-hooks'
import { getYarn, type YarnRecord } from '../data'

export function useYarn(id: string | undefined): YarnRecord | undefined {
  return useLiveQuery(() => (id ? getYarn(id) : undefined), [id])
}
