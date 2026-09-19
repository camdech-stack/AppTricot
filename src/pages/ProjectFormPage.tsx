import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import styles from './ProjectFormPage.module.css'
import { Button, ConfirmDialog, PageHeader } from '../components/ui'
import { STATUS_LABELS } from '../components/projects/statusMeta'
import {
  createProject,
  deleteProject,
  getProject,
  setCoverImage,
  updateProject,
  type ProjectColorKey,
  type ProjectCraft,
  type ProjectRecord,
  type ProjectStatus,
} from '../data'
import { useCoverImageUrl } from '../hooks/useCoverImageUrl'

const CRAFT_OPTIONS: { value: ProjectCraft; label: string }[] = [
  { value: 'knitting', label: 'Tricot' },
  { value: 'crochet', label: 'Crochet' },
]

const COLOR_OPTIONS: ProjectColorKey[] = ['prune', 'pervenche', 'terracotta', 'peche', 'rouge', 'rose']

const STATUS_OPTIONS: ProjectStatus[] = ['todo', 'in_progress', 'paused', 'done']

function dateOrUndefined(value: string): string | undefined {
  return value === '' ? undefined : value
}

export function ProjectFormPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const isEditing = Boolean(projectId)
  const navigate = useNavigate()

  const [loaded, setLoaded] = useState(!isEditing)
  const [name, setName] = useState('')
  const [craft, setCraft] = useState<ProjectCraft>('knitting')
  const [colorKey, setColorKey] = useState<ProjectColorKey>('prune')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('in_progress')
  const [startedAt, setStartedAt] = useState('')
  const [completedAt, setCompletedAt] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const existingCoverUrl = useCoverImageUrl(projectId)
  const [previewUrl, setPreviewUrl] = useState<string>()

  useEffect(() => {
    if (!projectId) return
    getProject(projectId)
      .then((project) => {
        if (!project) return
        setName(project.name)
        setCraft(project.craft)
        setColorKey(project.colorKey)
        setDescription(project.description)
        setStatus(project.status)
        setStartedAt(project.startedAt ?? '')
        setCompletedAt(project.completedAt ?? '')
        setLoaded(true)
      })
      .catch((error: unknown) => {
        console.error('Failed to load project', error)
      })
  }, [projectId])

  useEffect(() => {
    if (!photoFile) {
      setPreviewUrl(undefined)
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const coverPreview = previewUrl ?? existingCoverUrl

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const startedAtValue = dateOrUndefined(startedAt)
      const completedAtValue = dateOrUndefined(completedAt)

      const project: ProjectRecord = projectId
        ? await updateProject(projectId, {
            name: name.trim(),
            craft,
            colorKey,
            description,
            status,
            startedAt: startedAtValue,
            completedAt: completedAtValue,
          })
        : await createProject({
            name: name.trim(),
            craft,
            colorKey,
            description,
            status,
            startedAt: startedAtValue,
            completedAt: completedAtValue,
          })

      if (photoFile) {
        await setCoverImage(project.id, photoFile)
      }
      navigate(`/projets/${project.id}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!projectId || deleting) return
    setDeleting(true)
    try {
      await deleteProject(projectId)
      navigate('/projets')
    } finally {
      setDeleting(false)
    }
  }

  if (!loaded) {
    return <div className={styles.page} />
  }

  return (
    <div className={styles.page}>
      <PageHeader title={isEditing ? 'Modifier le projet' : 'Nouveau projet'} onBack={() => navigate(-1)} />
      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
        <label className={styles.field}>
          <span className={styles.label}>Nom</span>
          <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Type</span>
          <div className={styles.segmented}>
            {CRAFT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={craft === option.value}
                onClick={() => setCraft(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Couleur</span>
          <div className={styles.colorRow}>
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                className={color === colorKey ? styles.colorSwatchActive : styles.colorSwatch}
                style={{ background: `var(--color-project-${color})` }}
                aria-label={color}
                aria-pressed={colorKey === color}
                onClick={() => setColorKey(color)}
              />
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Photo de couverture</span>
          {coverPreview && <img src={coverPreview} alt="" className={styles.preview} />}
          <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Description</span>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Statut</span>
          <div className={styles.segmented}>
            {STATUS_OPTIONS.map((option) => (
              <button key={option} type="button" aria-pressed={status === option} onClick={() => setStatus(option)}>
                {STATUS_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Date de début</span>
          <input
            type="date"
            className={styles.input}
            value={startedAt}
            onChange={(event) => setStartedAt(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Date de fin</span>
          <input
            type="date"
            className={styles.input}
            value={completedAt}
            onChange={(event) => setCompletedAt(event.target.value)}
          />
        </label>

        <Button type="submit" size="lg" disabled={saving || !name.trim()}>
          {isEditing ? 'Enregistrer' : 'Créer le projet'}
        </Button>

        {isEditing && (
          <Button
            type="button"
            variant="ghost"
            className={styles.deleteButton}
            icon={<Trash2 size={18} strokeWidth={1.75} />}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            Supprimer le projet
          </Button>
        )}
      </form>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer le projet"
        message="Cette action supprime aussi ses compteurs, son historique et sa couverture. Elle est irréversible."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}
