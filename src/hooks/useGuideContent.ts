import { useLiveQuery } from 'dexie-react-hooks'
import { getGuideContent, type GuideContent } from '../data'

export function useGuideContent(guideId: string | undefined): GuideContent | undefined {
  return useLiveQuery(() => (guideId ? getGuideContent(guideId) : undefined), [guideId])
}
