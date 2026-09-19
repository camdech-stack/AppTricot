import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Layers, ListOrdered, Pencil } from 'lucide-react'
import styles from './ProjectDetailPage.module.css'
import layoutStyles from '../components/layout/AppLayout.module.css'
import { FloatingTabBar } from '../components/layout/FloatingTabBar'
import { Button, IconButton, Pill, ProgressRing, StatTile, WaveDivider } from '../components/ui'
import { CRAFT_LABELS, STATUS_LABELS, STATUS_PILL_COLORS } from '../components/projects/statusMeta'
import { useProject } from '../hooks/useProject'
import { useCounters } from '../hooks/useCounters'
import { useCoverImageUrl } from '../hooks/useCoverImageUrl'
import { useRelativeTime } from '../hooks/useRelativeTime'
import { computeProjectProgress, updateProject } from '../data'

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
  const mainCounter = (counters ?? []).find((counter) => counter.isMain)

  return (
    <div className={layoutStyles.shell}>
      <FloatingTabBar />
      <div className={layoutStyles.main}>
        <div className={layoutStyles.content}>
          <div className={styles.hero}>
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
            <h1 className={styles.name}>{project.name}</h1>
            <div className={styles.pills}>
              <Pill color={STATUS_PILL_COLORS[project.status]}>{STATUS_LABELS[project.status]}</Pill>
              <Pill color="blue">{CRAFT_LABELS[project.craft]}</Pill>
            </div>
          </div>
          <WaveDivider />

          <div className={styles.body}>
            {coverUrl && <img src={coverUrl} alt="" className={styles.cover} />}

            <div className={styles.progressRow}>
              <ProgressRing
                progress={progress.kind === 'percent' ? progress.ratio : 0}
                size={96}
                strokeWidth={10}
                label={progress.kind === 'percent' ? `${Math.round(progress.ratio * 100)} %` : `${progress.rows}`}
              />
            </div>

            <div className={styles.statsGrid}>
              <StatTile
                icon={<Calendar size={22} strokeWidth={1.75} />}
                value={project.startedAt ?? '—'}
                label="Début"
              />
              <StatTile
                icon={<ListOrdered size={22} strokeWidth={1.75} />}
                value={mainCounter?.value ?? 0}
                label="Rangs actuels"
                color="terracotta"
              />
              <StatTile
                icon={<Layers size={22} strokeWidth={1.75} />}
                value={(counters ?? []).length}
                label="Compteurs"
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
              onClick={() => navigate(`/projets/${projectId}/compteur`)}
            >
              Continuer
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
