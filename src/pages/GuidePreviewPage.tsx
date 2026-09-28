import { useNavigate, useParams } from 'react-router-dom'
import styles from './GuideFollowPage.module.css'
import { GuidePreviewScreen } from '../components/guides/follow/GuidePreviewScreen'
import { useGuide } from '../hooks/useGuide'
import { useGuideContent } from '../hooks/useGuideContent'
import { usePattern } from '../hooks/usePattern'

// /guides/:guideId/apercu — a read-only, project-free way to browse a guide
// exactly as it will look while following it, opened from the editor's
// "⋯" menu ("Aperçu"). See CLAUDE.md "Aperçu du guide". No wake lock: unlike
// an active follow session, nothing here is timed.
export function GuidePreviewPage() {
  const { guideId } = useParams<{ guideId: string }>()
  const navigate = useNavigate()
  const guide = useGuide(guideId)
  const content = useGuideContent(guideId)
  const linkedPatternRecord = usePattern(guide?.patternId ?? undefined)

  if (!guideId) return <div className={styles.page} />
  if (!guide || !content) return <div className={styles.page} />

  return (
    <div className={styles.page}>
      <GuidePreviewScreen
        guideName={guide.name}
        content={content}
        linkedPattern={linkedPatternRecord ? { id: linkedPatternRecord.id, name: linkedPatternRecord.name } : null}
        onBack={() => navigate(`/guides/${guideId}`)}
      />
    </div>
  )
}
