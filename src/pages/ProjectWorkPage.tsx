import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import styles from './ProjectWorkPage.module.css'
import { IconButton } from '../components/ui'
import { PdfViewerCore } from '../components/patterns/PdfViewerCore'
import { CounterPanel } from '../components/counters/CounterPanel'
import { useProject } from '../hooks/useProject'
import { useProjectPatterns } from '../hooks/useProjectPatterns'
import { usePatternLibraryContext } from '../hooks/usePatternLibraryContext'
import { useWakeLock } from '../hooks/useWakeLock'
import { getLastUsedPatternIdForProject, updateProject, type ProjectWorkTab } from '../data'

// /projets/:projectId/travail — no FloatingTabBar, screen kept on. Pattern
// and counter panes are both always mounted (never conditionally rendered)
// so the PDF's page/zoom/position survive switching tabs — see CLAUDE.md
// "Vue de travail d'un projet".
export function ProjectWorkPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const project = useProject(projectId)
  const links = useProjectPatterns(projectId ?? '')
  const context = usePatternLibraryContext()

  useWakeLock(true)

  const [tab, setTab] = useState<ProjectWorkTab>('counter')
  const tabInitializedRef = useRef(false)
  const [selectedPatternId, setSelectedPatternId] = useState<string | undefined>(undefined)
  const patternSelectionInitializedRef = useRef(false)

  useEffect(() => {
    if (!project || tabInitializedRef.current) return
    tabInitializedRef.current = true
    setTab(project.lastWorkTab ?? (links && links.length > 0 ? 'pattern' : 'counter'))
  }, [project, links])

  useEffect(() => {
    if (!projectId || !links || patternSelectionInitializedRef.current || links.length === 0) return
    patternSelectionInitializedRef.current = true
    void getLastUsedPatternIdForProject(projectId).then((lastUsed) => {
      const stillLinked = lastUsed && links.some((link) => link.patternId === lastUsed)
      setSelectedPatternId(stillLinked ? lastUsed : links[0]?.patternId)
    })
  }, [projectId, links])

  function handleTabChange(next: ProjectWorkTab) {
    setTab(next)
    if (projectId) void updateProject(projectId, { lastWorkTab: next })
  }

  if (!project || !projectId || !context) {
    return <div className={styles.page} />
  }

  const linkedPatterns = (links ?? [])
    .map((link) => context.patterns.find((pattern) => pattern.id === link.patternId))
    .filter((pattern): pattern is NonNullable<typeof pattern> => Boolean(pattern))

  const selectedPattern = linkedPatterns.find((pattern) => pattern.id === selectedPatternId) ?? linkedPatterns[0]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={() => navigate(`/projets/${projectId}`)} />
        <span className={styles.headerTitle}>{project.name}</span>
      </div>

      <div className={styles.tabBar} role="tablist" aria-label="Vue de travail">
        <button type="button" role="tab" aria-selected={tab === 'pattern'} onClick={() => handleTabChange('pattern')}>
          Patron
        </button>
        <button type="button" role="tab" aria-selected={tab === 'counter'} onClick={() => handleTabChange('counter')}>
          Compteur
        </button>
        <button type="button" role="tab" aria-selected={false} disabled className={styles.tabDisabled}>
          Guide (bientôt)
        </button>
      </div>

      <div className={styles.panes}>
        <div className={tab === 'pattern' ? styles.paneVisible : styles.paneHidden} data-pane="pattern">
          {linkedPatterns.length > 1 && (
            <div className={styles.patternSelector}>
              {linkedPatterns.map((pattern) => (
                <button key={pattern.id} type="button" aria-pressed={pattern.id === selectedPattern?.id} onClick={() => setSelectedPatternId(pattern.id)}>
                  {pattern.name}
                </button>
              ))}
            </div>
          )}
          {selectedPattern ? (
            <div className={styles.viewerHost}>
              <PdfViewerCore patternId={selectedPattern.id} projectId={projectId} patternName={selectedPattern.name} />
            </div>
          ) : (
            <div className={styles.emptyPattern}>
              <p>Aucun patron associé à ce projet.</p>
            </div>
          )}
        </div>

        <div className={tab === 'counter' ? styles.paneVisible : styles.paneHidden} data-pane="counter">
          <CounterPanel projectId={projectId} project={project} isStandalone={false} />
        </div>
      </div>
    </div>
  )
}
