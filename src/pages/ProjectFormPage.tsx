import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import styles from './ProjectFormPage.module.css'
import { Button, ConfirmDialog, PageHeader } from '../components/ui'
import { STATUS_LABELS } from '../components/projects/statusMeta'
import {
  compressCoverImage,
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
  const [targetEndDate, setTargetEndDate] = useState('')
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [photoError, setPhotoError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [keepYarnUsage, setKeepYarnUsage] = useState(true)

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
        setTargetEndDate(project.targetEndDate ?? '')
        setLoaded(true)
      })
      .catch((error: unknown) => {
        console.error('Failed to load project', error)
      })
  }, [projectId])

  useEffect(() => {
    if (!coverBlob) {
      setPreviewUrl(undefined)
      return
    }
    const url = URL.createObjectURL(coverBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [coverBlob])

  const coverPreview = previewUrl ?? existingCoverUrl

  // Compresses right when the photo is picked rather than at submit time:
  // the raw file (potentially a huge, uncompressed camera photo) is never
  // held onto or rendered directly — only the small compressed result ever
  // reaches the preview <img> or IndexedDB. Decoding a multi-ten-megapixel
  // original straight into an <img> is what crashed the page on iPad.
  async function handlePhotoChange(file: File | undefined) {
    setPhotoError(undefined)
    if (!file) {
      setCoverBlob(null)
      return
    }
    setPhotoProcessing(true)
    try {
      const blob = await compressCoverImage(file)
      setCoverBlob(blob)
    } catch (error: unknown) {
      console.error('Failed to process cover photo', error)
      setCoverBlob(null)
      setPhotoError("Cette photo n'a pas pu être utilisée. Essayez-en une autre.")
    } finally {
      setPhotoProcessing(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const startedAtValue = dateOrUndefined(startedAt)
      const completedAtValue = dateOrUndefined(completedAt)
      const targetEndDateValue = dateOrUndefined(targetEndDate) ?? null

      const project: ProjectRecord = projectId
        ? await updateProject(projectId, {
            name: name.trim(),
            craft,
            colorKey,
            description,
            status,
            startedAt: startedAtValue,
            completedAt: completedAtValue,
            targetEndDate: targetEndDateValue,
          })
        : await createProject({
            name: name.trim(),
            craft,
            colorKey,
            description,
            status,
            startedAt: startedAtValue,
            completedAt: completedAtValue,
            targetEndDate: targetEndDateValue,
          })

      if (coverBlob) {
        await setCoverImage(project.id, coverBlob)
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
      await deleteProject(projectId, keepYarnUsage)
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
      <div className={styles.scrollArea}>
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <label className={styles.field}>
            <span className={styles.label}>Nom</span>
            <input
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
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
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void handlePhotoChange(event.target.files?.[0])}
            />
            {photoProcessing && <span className={styles.photoStatus}>Traitement de la photo…</span>}
            {photoError && <span className={styles.photoError}>{photoError}</span>}
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
                <button
                  key={option}
                  type="button"
                  aria-pressed={status === option}
                  onClick={() => setStatus(option)}
                >
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

          <label className={styles.field}>
            <span className={styles.label}>Date de fin prévue</span>
            <input
              type="date"
              className={styles.input}
              value={targetEndDate}
              onChange={(event) => setTargetEndDate(event.target.value)}
            />
          </label>

          <Button type="submit" size="lg" disabled={saving || photoProcessing || !name.trim()}>
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
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer le projet"
        message="Cette action supprime aussi ses compteurs, son historique et sa couverture. Elle est irréversible."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      >
        <label className={styles.keepYarnOption}>
          <input type="checkbox" checked={keepYarnUsage} onChange={(event) => setKeepYarnUsage(event.target.checked)} />
          Conserver la laine consommée dans le stock
        </label>
      </ConfirmDialog>
    </div>
  )
}
