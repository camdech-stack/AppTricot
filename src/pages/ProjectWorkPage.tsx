import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import styles from './ProjectWorkPage.module.css'
import { IconButton } from '../components/ui'
import { PdfViewerCore } from '../components/patterns/PdfViewerCore'
import { CounterPanel } from '../components/counters/CounterPanel'
import { LazyGuidePanel } from '../components/guides/follow/LazyGuidePanel'
import { useProject } from '../hooks/useProject'
import { useProjectPatterns } from '../hooks/useProjectPatterns'
import { useProjectGuides } from '../hooks/useProjectGuides'
import { useLastUsedGuideId } from '../hooks/useLastUsedGuideId'
import { usePatternLibraryContext } from '../hooks/usePatternLibraryContext'
import { useGuideLibraryContext } from '../hooks/useGuideLibraryContext'
import { useWakeLock } from '../hooks/useWakeLock'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { getLastUsedPatternIdForProject, updateProject, type ProjectWorkTab } from '../data'

// Mirrors ProjectWorkPage.module.css's own split-view breakpoint — see
// useMediaQuery for why this one place needs a JS media query instead of
// the pure-CSS toggle used everywhere else (FloatingTabBar).
const DESKTOP_SPLIT_QUERY = '(min-width: 1024px) and (orientation: landscape)'

// /projets/:projectId/travail — no FloatingTabBar, screen kept on. Pattern,
// guide and counter panes are all always mounted (never conditionally
// rendered) so each one's own position/state survives switching tabs — see
// CLAUDE.md "Vue de travail d'un projet".
export function ProjectWorkPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const project = useProject(projectId)
  const links = useProjectPatterns(projectId ?? '')
  const guideLinks = useProjectGuides(projectId ?? '')
  const context = usePatternLibraryContext()
  const guideContext = useGuideLibraryContext()
  const lastUsedGuideId = useLastUsedGuideId(projectId, guideLinks)
  const isDesktopSplit = useMediaQuery(DESKTOP_SPLIT_QUERY)

  useWakeLock(true)

  // Set when opened from a specific pattern row (ProjectPatternCard) so that
  // exact pattern opens on the Patron tab, instead of whichever one
  // patternViewStates last recorded for this project.
  const requestedPatternId = (location.state as { patternId?: string } | null)?.patternId

  const [tab, setTab] = useState<ProjectWorkTab>('counter')
  const tabInitializedRef = useRef(false)
  const [selectedPatternId, setSelectedPatternId] = useState<string | undefined>(undefined)
  const patternSelectionInitializedRef = useRef(false)
  const [selectedGuideId, setSelectedGuideId] = useState<string | undefined>(undefined)
  const guideSelectionInitializedRef = useRef(false)

  useEffect(() => {
    if (!project || tabInitializedRef.current) return
    tabInitializedRef.current = true
    setTab(requestedPatternId ? 'pattern' : (project.lastWorkTab ?? (links && links.length > 0 ? 'pattern' : 'counter')))
  }, [project, links, requestedPatternId])

  useEffect(() => {
    if (!projectId || !links || patternSelectionInitializedRef.current || links.length === 0) return
    patternSelectionInitializedRef.current = true
    if (requestedPatternId && links.some((link) => link.patternId === requestedPatternId)) {
      setSelectedPatternId(requestedPatternId)
      return
    }
    void getLastUsedPatternIdForProject(projectId).then((lastUsed) => {
      const stillLinked = lastUsed && links.some((link) => link.patternId === lastUsed)
      setSelectedPatternId(stillLinked ? lastUsed : links[0]?.patternId)
    })
  }, [projectId, links, requestedPatternId])

  useEffect(() => {
    if (!guideLinks || guideSelectionInitializedRef.current || guideLinks.length === 0 || lastUsedGuideId === undefined) return
    guideSelectionInitializedRef.current = true
    setSelectedGuideId(lastUsedGuideId)
  }, [guideLinks, lastUsedGuideId])

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

  const linkedGuides = (guideLinks ?? [])
    .map((link) => guideContext?.guides.find((guide) => guide.id === link.guideId))
    .filter((guide): guide is NonNullable<typeof guide> => Boolean(guide))
  const selectedGuide = linkedGuides.find((guide) => guide.id === selectedGuideId) ?? linkedGuides[0]

  // On the desktop split, the right column shows Guide/Compteur regardless
  // of `tab` (Patron is always the left pane there) — `tab` still tracks
  // which of the two was last active so it persists across breakpoints.
  const rightTab: 'guide' | 'counter' = tab === 'guide' || tab === 'counter' ? tab : linkedGuides.length > 0 ? 'guide' : 'counter'
  const guidePaneActive = isDesktopSplit ? rightTab === 'guide' : tab === 'guide'
  const counterPaneActive = isDesktopSplit ? rightTab === 'counter' : tab === 'counter'

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
        <button type="button" role="tab" aria-selected={tab === 'guide'} onClick={() => handleTabChange('guide')}>
          Guide
        </button>
        <button type="button" role="tab" aria-selected={tab === 'counter'} onClick={() => handleTabChange('counter')}>
          Compteur
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

        <div className={styles.rightColumn}>
          <div className={styles.innerTabBar} role="tablist" aria-label="Guide ou compteur">
            <button type="button" role="tab" aria-selected={rightTab === 'guide'} onClick={() => handleTabChange('guide')}>
              Guide
            </button>
            <button type="button" role="tab" aria-selected={rightTab === 'counter'} onClick={() => handleTabChange('counter')}>
              Compteur
            </button>
          </div>

          <div className={guidePaneActive ? styles.paneVisible : styles.paneHidden} data-pane="guide">
            {linkedGuides.length > 1 && (
              <div className={styles.patternSelector}>
                {linkedGuides.map((guide) => (
                  <button key={guide.id} type="button" aria-pressed={guide.id === selectedGuide?.id} onClick={() => setSelectedGuideId(guide.id)}>
                    {guide.name}
                  </button>
                ))}
              </div>
            )}
            {selectedGuide ? (
              <div className={styles.viewerHost}>
                <LazyGuidePanel projectId={projectId} guideId={selectedGuide.id} />
              </div>
            ) : (
              <div className={styles.emptyPattern}>
                <p>Aucun guide associé à ce projet.</p>
              </div>
            )}
          </div>

          <div className={counterPaneActive ? styles.paneVisible : styles.paneHidden} data-pane="counter">
            <CounterPanel projectId={projectId} project={project} isStandalone={false} />
          </div>
        </div>
      </div>
    </div>
  )
}
