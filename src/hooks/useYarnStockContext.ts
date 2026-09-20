import { useLiveQuery } from 'dexie-react-hooks'
import {
  getAllProjectYarns,
  getAllYarnUsages,
  getProjects,
  getYarns,
  type ProjectRecord,
  type ProjectYarnRecord,
  type YarnRecord,
  type YarnUsageRecord,
} from '../data'

export interface YarnStockContext {
  yarns: YarnRecord[]
  usages: YarnUsageRecord[]
  projectYarns: ProjectYarnRecord[]
  projects: ProjectRecord[]
}

// Everything the stock math (yarnMath.ts) needs across the whole app: every
// yarn's numbers depend on usages and links for every project, not just its
// own, so the list and detail screens share this single combined query
// rather than each re-deriving it from partial data.
export function useYarnStockContext(): YarnStockContext | undefined {
  return useLiveQuery(
    async () => {
      const [yarns, usages, projectYarns, projects] = await Promise.all([
        getYarns(),
        getAllYarnUsages(),
        getAllProjectYarns(),
        getProjects(),
      ])
      return { yarns, usages, projectYarns, projects }
    },
    [],
  )
}
