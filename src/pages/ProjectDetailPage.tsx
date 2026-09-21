import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, ListOrdered, Pencil, Timer } from 'lucide-react'
import styles from './ProjectDetailPage.module.css'
import layoutStyles from '../components/layout/AppLayout.module.css'
import { FloatingTabBar } from '../components/layout/FloatingTabBar'
import { Button, IconButton, Pill, ProgressRing, StatTile, WaveDivider } from '../components/ui'
import { TimeCard } from '../components/sessions/TimeCard'
import { SessionHistorySheet } from '../components/sessions/SessionHistorySheet'
import { ProjectYarnCard } from '../components/yarn/ProjectYarnCard'
import { ProjectPatternCard } from '../components/projects/ProjectPatternCard'
import { ProjectGuideCard } from '../components/projects/ProjectGuideCard'
import { CRAFT_LABELS, STATUS_LABELS, STATUS_PILL_COLORS } from '../components/projects/statusMeta'
import { projectColorVar, projectColorSoftVar, projectGradient } from '../components/projects/colorMeta'
import { useProject } from '../hooks/useProject'
import { useCounters } from '../hooks/useCounters'
import { useProjectPatterns } from '../hooks/useProjectPatterns'
import { useCoverImageUrl } from '../hooks/useCoverImageUrl'
import { useRelativeTime } from '../hooks/useRelativeTime'
import { useNow } from '../hooks/useNow'
import { formatDateFr } from '../utils/formatDate'
import { formatDuration } from '../utils/formatDuration'
import { daysSince, daysUntil } from '../utils/dateDiff'
import {
  computeProjectProgress,
  computeProjectTimeStats,
  getLiveSessionId,
  getOpenSession,
  getSessionsForTarget,
  todayDateString,
  updateProject,
} from '../data'

const NOTES_SAVE_DELAY_MS = 600

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const project = useProject(projectId)
  const counters = useCounters(projectId ?? null)
  const patternLinks = useProjectPatterns(projectId ?? '')
  const coverUrl = useCoverImageUrl(projectId)
  const lastActivity = useRelativeTime(project?.lastActivityAt)

  const sessionTarget = { projectId: projectId ?? '' }
  const sessions = useLiveQuery(() => getSessionsForTarget(sessionTarget), [sessionTarget.projectId])
  const openSession = useLiveQuery(() => getOpenSession(), [])
  const now = useNow(60_000)
  const timeStats = computeProjectTimeStats(sessions ?? [], now, getLiveSessionId())
  const isTimeRunning = Boolean(openSession && openSession.projectId === sessionTarget.projectId)

  const [notes, setNotes] = useState('')
  const notesTimeoutRef = useRef<number | undefined>(undefined)
  const loadedNotesForProject = useRef<string | undefined>(undefined)
  const [sessionHistoryOpen, setSessionHistoryOpen] = useState(false)

  useEffect(() => {
    if (project && loadedNotesForProject.current !== project.id) {
      setNotes(project.notes)
      loadedNotesForProject.current = project.id
    }
  }, [project])

  useEffect(() => () => window.clearTimeout(notesTimeoutRef.current), [])

  function handleNotesChange(value: string) {
    setNotes(value)
    if (!projectId) return
    window.clearTimeout(notesTimeoutRef.current)
    notesTimeoutRef.current = window.setTimeout(() => {
      updateProject(projectId, { notes: value }).catch((error: unknown) => {
        console.error('Failed to save notes', error)
      })
    }, NOTES_SAVE_DELAY_MS)
  }

  if (!project || !projectId) {
    return <div className={layoutStyles.shell} />
  }

  const progress = computeProjectProgress(counters ?? [])
  const totalRows = (counters ?? []).reduce((sum, counter) => sum + counter.value, 0)
  const isDone = project.status === 'done'
  const hasPatterns = (patternLinks?.length ?? 0) > 0

  const heroStyle: CSSProperties = coverUrl
    ? {
        backgroundImage: `linear-gradient(to top, rgba(20, 10, 14, 0.8), rgba(20, 10, 14, 0.25) 60%), url(${coverUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: projectGradient(project.colorKey) }

  const today = todayDateString()
  const startedLabel = project.startedAt ? `Depuis le ${formatDateFr(project.startedAt)}` : null
  let endLabel: string | null = null
  if (isDone && project.completedAt) {
    endLabel = `Terminé le ${formatDateFr(project.completedAt)}`
  } else if (project.targetEndDate) {
    const daysLeft = daysUntil(project.targetEndDate, today)
    if (daysLeft > 0) endLabel = `Fin prévue le ${formatDateFr(project.targetEndDate)} (dans ${daysLeft} j)`
    else if (daysLeft === 0) endLabel = 'Fin prévue aujourd’hui'
    else endLabel = `Fin prévue le ${formatDateFr(project.targetEndDate)} (dépassée de ${Math.abs(daysLeft)} j)`
  }

  return (
    <div className={layoutStyles.shell}>
      <FloatingTabBar />
      <div className={layoutStyles.main}>
        <div className={layoutStyles.content}>
          <div className={styles.hero} style={heroStyle}>
            <div className={styles.topBar}>
              <IconButton
                icon={<ArrowLeft strokeWidth={1.75} />}
                label="Retour"
                className={styles.heroIconButton}
                onClick={() => navigate('/projets')}
              />
              <button
                type="button"
                className={styles.editButton}
                onClick={() => navigate(`/projets/${projectId}/modifier`)}
              >
                <Pencil size={18} strokeWidth={1.75} />
                Modifier
              </button>
            </div>
            <h1 className={styles.name}>
              {project.name}
              {isDone && (
                <span className={styles.doneBadge} aria-label="Projet terminé">
                  <CheckCircle2 size={22} strokeWidth={2} />
                </span>
              )}
            </h1>
            <div className={styles.pills}>
              <Pill color={STATUS_PILL_COLORS[project.status]}>{STATUS_LABELS[project.status]}</Pill>
              <Pill color="blue">{CRAFT_LABELS[project.craft]}</Pill>
              {timeStats.totalMs > 0 && (
                <Pill color="gold">
                  {isTimeRunning && <span className={styles.runningDot} aria-hidden="true" />}
                  {formatDuration(timeStats.totalMs)}
                </Pill>
              )}
            </div>
            {(startedLabel || endLabel) && (
              <div className={styles.dates}>
                {[startedLabel, endLabel].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <WaveDivider />

          <div className={styles.body}>
            <div className={styles.statsRow}>
              <div className={styles.progressCol}>
                <ProgressRing
                  progress={progress.kind === 'percent' ? progress.ratio : 0}
                  size={96}
                  strokeWidth={10}
                  label={
                    progress.kind === 'percent' ? `${Math.round(progress.ratio * 100)} %` : `${progress.rows}`
                  }
                  color={projectColorVar(project.colorKey)}
                  trackColor={projectColorSoftVar(project.colorKey)}
                />
              </div>

              <div className={styles.statsCol}>
                <StatTile
                  icon={<CalendarDays size={20} strokeWidth={1.75} />}
                  value={project.startedAt ? daysSince(project.startedAt, today) : '—'}
                  label="Jours depuis le début"
                  color="gold"
                />
                <StatTile
                  icon={<Timer size={20} strokeWidth={1.75} />}
                  value={formatDuration(timeStats.totalMs)}
                  label="Temps travaillé"
                  color="blue"
                />
                <StatTile
                  icon={<ListOrdered size={20} strokeWidth={1.75} />}
                  value={totalRows}
                  label="Rangs tricotés"
                  color="terracotta"
                />
                <StatTile
                  icon={<Clock size={20} strokeWidth={1.75} />}
                  value={lastActivity ?? '—'}
                  label="Dernière activité"
                  color="sage"
                />
              </div>
            </div>

            {project.description && <p className={styles.description}>{project.description}</p>}

            <div className={styles.notesCard}>
              <div className={styles.notesLabel}>Notes</div>
              <textarea
                className={styles.notesInput}
                value={notes}
                onChange={(event) => handleNotesChange(event.target.value)}
                rows={4}
                placeholder="Notes libres sur ce projet…"
              />
            </div>

            <TimeCard
              target={sessionTarget}
              accentColor={projectColorVar(project.colorKey)}
              onOpenHistory={() => setSessionHistoryOpen(true)}
            />

            <ProjectYarnCard projectId={projectId} />

            <ProjectPatternCard projectId={projectId} />

            <ProjectGuideCard projectId={projectId} />

            <Button
              size="lg"
              className={styles.continueButton}
              style={{ background: projectGradient(project.colorKey) }}
              onClick={() => navigate(hasPatterns ? `/projets/${projectId}/travail` : `/projets/${projectId}/compteur`)}
            >
              Continuer
            </Button>

            <div className={styles.secondaryActionsRow}>
              {hasPatterns && (
                <Button size="md" variant="secondary" onClick={() => navigate(`/projets/${projectId}/compteur`)}>
                  Compteur seul
                </Button>
              )}
              <Button size="md" variant="secondary" disabled className={styles.guideButton}>
                Guide de patron (bientôt)
              </Button>
            </div>
          </div>
        </div>
      </div>

      {sessionHistoryOpen && (
        <SessionHistorySheet target={sessionTarget} onClose={() => setSessionHistoryOpen(false)} />
      )}
    </div>
  )
}
