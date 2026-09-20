import { useLiveQuery } from 'dexie-react-hooks'
import { getYarns, type YarnRecord } from '../data'

export function useYarns(): YarnRecord[] | undefined {
  return useLiveQuery(() => getYarns(), [])
}
