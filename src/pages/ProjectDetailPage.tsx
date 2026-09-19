import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, ListOrdered, Pencil } from 'lucide-react'
import styles from './ProjectDetailPage.module.css'
import layoutStyles from '../components/layout/AppLayout.module.css'
import { FloatingTabBar } from '../components/layout/FloatingTabBar'
import { Button, IconButton, Pill, ProgressRing, StatTile, WaveDivider } from '../components/ui'
import { CRAFT_LABELS, STATUS_LABELS, STATUS_PILL_COLORS } from '../components/projects/statusMeta'
import { projectColorVar, projectColorSoftVar, projectGradient } from '../components/projects/colorMeta'
import { useProject } from '../hooks/useProject'
import { useCounters } from '../hooks/useCounters'
import { useCoverImageUrl } from '../hooks/useCoverImageUrl'
import { useRelativeTime } from '../hooks/useRelativeTime'
import { formatDateFr } from '../utils/formatDate'
import { daysSince, daysUntil } from '../utils/dateDiff'
import { computeProjectProgress, todayDateString, updateProject } from '../data'

const NOTES_SAVE_DELAY_MS = 600

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const project = useProject(projectId)
  const counters = useCounters(projectId ?? null)
  const coverUrl = useCoverImageUrl(projectId)
  const lastActivity = useRelativeTime(project?.lastActivityAt)

  const [notes, setNotes] = useState('')
  const notesTimeoutRef = useRef<number | undefined>(undefined)
  const loadedNotesForProject = useRef<string | undefined>(undefined)

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
            </div>
            {(startedLabel || endLabel) && (
              <div className={styles.dates}>
                {[startedLabel, endLabel].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <WaveDivider />

          <div className={styles.body}>
            <div className={styles.progressRow}>
              <ProgressRing
                progress={progress.kind === 'percent' ? progress.ratio : 0}
                size={96}
                strokeWidth={10}
                label={progress.kind === 'percent' ? `${Math.round(progress.ratio * 100)} %` : `${progress.rows}`}
                color={projectColorVar(project.colorKey)}
                trackColor={projectColorSoftVar(project.colorKey)}
              />
            </div>

            <div className={styles.statsGrid}>
              <StatTile
                icon={<ListOrdered size={22} strokeWidth={1.75} />}
                value={totalRows}
                label="Rangs tricotés"
                color="terracotta"
              />
              <StatTile
                icon={<CalendarDays size={22} strokeWidth={1.75} />}
                value={project.startedAt ? daysSince(project.startedAt, today) : '—'}
                label="Jours depuis le début"
                color="gold"
              />
              <StatTile
                icon={<Clock size={22} strokeWidth={1.75} />}
                value={lastActivity ?? '—'}
                label="Dernière activité"
                color="blue"
              />
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

            <div className={styles.comingSoonGrid}>
              <div className={styles.comingSoonCard}>
                Laine
                <span>Bientôt</span>
              </div>
              <div className={styles.comingSoonCard}>
                Patron
                <span>Bientôt</span>
              </div>
              <div className={styles.comingSoonCard}>
                Guide de patron
                <span>Bientôt</span>
              </div>
            </div>

            <Button
              size="lg"
              className={styles.continueButton}
              style={{ background: projectGradient(project.colorKey) }}
              onClick={() => navigate(`/projets/${projectId}/compteur`)}
            >
              Continuer
            </Button>

            <Button size="md" variant="secondary" disabled className={styles.guideButton}>
              Guide de patron (bientôt)
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
