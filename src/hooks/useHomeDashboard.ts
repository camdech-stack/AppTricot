import { useLiveQuery } from 'dexie-react-hooks'
import { getHomeDashboard, type HomeDashboard } from '../data'

export function useHomeDashboard(): HomeDashboard | undefined {
  return useLiveQuery(() => getHomeDashboard(), [])
}
