import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import styles from './PatternViewerPage.module.css'
import { PdfViewerCore } from '../components/patterns/PdfViewerCore'
import { usePattern } from '../hooks/usePattern'

// Dedicated, full-screen route (no FloatingTabBar) — see CLAUDE.md
// "Visionneuse PDF". An optional ?projet= query param scopes the reading
// position to that project instead of the library (projectId null).
export function PatternViewerPage() {
  const { patternId } = useParams<{ patternId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const projectId = searchParams.get('projet')
  const pattern = usePattern(patternId)

  if (!patternId) return <div className={styles.page} />

  return (
    <div className={styles.page}>
      <PdfViewerCore
        patternId={patternId}
        projectId={projectId}
        patternName={pattern?.name ?? ''}
        onBack={() => navigate(projectId ? `/projets/${projectId}/travail` : `/patrons/${patternId}`)}
      />
    </div>
  )
}
