import { useLiveQuery } from 'dexie-react-hooks'
import { db, type GuideProgressRecord } from '../data'

// Every project's progress through one guide, keyed by projectId — for the
// guides library/card, which shows "pour chaque projet lié, la progression"
// (see CLAUDE.md "Fiche d'un guide et liste des guides").
export function useGuideProjectsProgress(guideId: string | undefined): Record<string, GuideProgressRecord> | undefined {
  return useLiveQuery(async () => {
    if (!guideId) return {}
    const records = await db.guideProgress.where('guideId').equals(guideId).toArray()
    const byProjectId: Record<string, GuideProgressRecord> = {}
    for (const record of records) byProjectId[record.projectId] = record
    return byProjectId
  }, [guideId])
}
