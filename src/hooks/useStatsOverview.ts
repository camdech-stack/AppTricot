import { useLiveQuery } from 'dexie-react-hooks'
import { getStatsOverview, type StatsOverview, type StatsView } from '../data'

export function useStatsOverview(view: StatsView): StatsOverview | undefined {
  return useLiveQuery(() => getStatsOverview(view), [view])
}
