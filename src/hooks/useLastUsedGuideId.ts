import { useLiveQuery } from 'dexie-react-hooks'
import { getLastUsedGuideId, type ProjectGuideRecord } from '../data'

// No dedicated "last used guide" field exists on ProjectRecord — the choice
// lives in getLastUsedGuideId (most recently advanced linked guide, else the
// first linked one), shared with the home screen's "Reprendre". `links` is
// only a re-run trigger for when guides are linked/unlinked. Used by the
// project work view when several guides are linked (see CLAUDE.md "Vue de travail").
export function useLastUsedGuideId(projectId: string | undefined, links: ProjectGuideRecord[] | undefined): string | undefined {
  return useLiveQuery(async () => {
    if (!projectId || !links || links.length === 0) return undefined
    return (await getLastUsedGuideId(projectId)) ?? undefined
  }, [projectId, links])
}
