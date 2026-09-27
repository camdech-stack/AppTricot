import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ProjectGuideRecord } from '../data'

// No dedicated "last used guide" field exists on ProjectRecord — instead,
// this picks whichever linked guide was most recently advanced
// (guideProgress.lastAdvancedAt), falling back to the first linked guide
// (by position) when none has been started yet. Used by the project work
// view when several guides are linked (see CLAUDE.md "Vue de travail").
export function useLastUsedGuideId(projectId: string | undefined, links: ProjectGuideRecord[] | undefined): string | undefined {
  return useLiveQuery(async () => {
    if (!projectId || !links || links.length === 0) return undefined
    if (links.length === 1) return links[0]!.guideId

    const records = await db.guideProgress.where('projectId').equals(projectId).toArray()
    const linkedIds = new Set(links.map((link) => link.guideId))
    const relevant = records.filter((record) => linkedIds.has(record.guideId))
    if (relevant.length === 0) {
      return links.slice().sort((a, b) => a.position - b.position)[0]!.guideId
    }
    const mostRecent = relevant.reduce((best, record) => (record.lastAdvancedAt > best.lastAdvancedAt ? record : best))
    return mostRecent.guideId
  }, [projectId, links])
}
