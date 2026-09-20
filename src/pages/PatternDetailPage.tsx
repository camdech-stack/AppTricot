import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Image, Plus, RefreshCw, Trash2 } from 'lucide-react'
import styles from './PatternDetailPage.module.css'
import layoutStyles from '../components/layout/AppLayout.module.css'
import { FloatingTabBar } from '../components/layout/FloatingTabBar'
import { Button, ConfirmDialog, IconButton, WaveDivider } from '../components/ui'
import { TagEditor } from '../components/patterns/TagEditor'
import { AssociateProjectSheet } from '../components/patterns/AssociateProjectSheet'
import { CRAFT_LABELS } from '../components/projects/statusMeta'
import { usePattern } from '../hooks/usePattern'
import { usePatternCoverUrl } from '../hooks/usePatternCoverUrl'
import { usePatternLibraryContext } from '../hooks/usePatternLibraryContext'
import { extractPdfMetadata, PdfReadError } from '../pdf/extractPdfMetadata'
import { formatFileSize } from '../utils/formatFileSize'
import {
  compressCoverImage,
  deletePattern,
  hashBytes,
  replacePatternFile,
  setPatternCover,
  unlinkPatternFromProject,
  updatePatternMeta,
  validatePdfSignature,
  pdfValidationMessage,
  type ProjectCraft,
  type ProjectPatternRecord,
  type ProjectRecord,
} from '../data'

const META_SAVE_DELAY_MS = 600

export function PatternDetailPage() {
  const { patternId } = useParams<{ patternId: string }>()
  const navigate = useNavigate()
  const pattern = usePattern(patternId)
  const coverUrl = usePatternCoverUrl(patternId)
  const context = usePatternLibraryContext()

  const [name, setName] = useState('')
  const [craft, setCraft] = useState<ProjectCraft | ''>('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const loadedForId = useRef<string | undefined>(undefined)
  const saveTimeoutRef = useRef<number | undefined>(undefined)

  const [associateOpen, setAssociateOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [replaceError, setReplaceError] = useState<string>()
  const [replacing, setReplacing] = useState(false)
  const [photoError, setPhotoError] = useState<string>()
  const coverInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pattern && loadedForId.current !== pattern.id) {
      setName(pattern.name)
      setCraft(pattern.craft ?? '')
      setSource(pattern.source)
      setNotes(pattern.notes)
      loadedForId.current = pattern.id
    }
  }, [pattern])

  useEffect(() => () => window.clearTimeout(saveTimeoutRef.current), [])

  function scheduleMetaSave(next: { name?: string; craft?: ProjectCraft | ''; source?: string; notes?: string }) {
    if (!patternId) return
    window.clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = window.setTimeout(() => {
      void updatePatternMeta(patternId, {
        name: (next.name ?? name).trim() || pattern?.name,
        craft: (next.craft ?? craft) || null,
        source: next.source ?? source,
        notes: next.notes ?? notes,
      })
    }, META_SAVE_DELAY_MS)
  }

  async function handleTagsChange(tags: string[]) {
    if (!patternId) return
    await updatePatternMeta(patternId, { tags })
  }

  async function handleCoverChange(file: File | undefined) {
    if (!file || !patternId) return
    setPhotoError(undefined)
    try {
      const blob = await compressCoverImage(file)
      await setPatternCover(patternId, blob, 'custom')
    } catch (error) {
      console.error('Failed to process pattern cover', error)
      setPhotoError("Cette photo n'a pas pu être utilisée. Essaie-en une autre.")
    }
  }

  async function handleReplaceFile(file: File | undefined) {
    if (!file || !patternId || !pattern) return
    setReplaceError(undefined)
    setReplacing(true)
    try {
      const bytes = await file.arrayBuffer()
      const signatureError = validatePdfSignature(bytes)
      if (signatureError) {
        setReplaceError(pdfValidationMessage(signatureError))
        return
      }
      const metadata = await extractPdfMetadata(bytes)
      const hash = await hashBytes(bytes)
      await replacePatternFile(patternId, {
        fileBlob: new Blob([bytes], { type: 'application/pdf' }),
        fileName: file.name,
        fileHash: hash,
        pageCount: metadata.pageCount,
        sizeBytes: file.size,
        autoCoverBlob: metadata.coverBlob,
      })
    } catch (error) {
      setReplaceError(error instanceof PdfReadError ? error.message : "Échec du remplacement du fichier.")
    } finally {
      setReplacing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!patternId) return
    await deletePattern(patternId)
    navigate('/patrons')
  }

  if (!pattern || !patternId || !context) {
    return <div className={layoutStyles.shell} />
  }

  const links = context.projectPatterns.filter((link) => link.patternId === patternId)
  const linkedProjects: { link: ProjectPatternRecord; project: ProjectRecord }[] = links
    .map((link) => {
      const project = context.projects.find((candidate) => candidate.id === link.projectId)
      return project ? { link, project } : null
    })
    .filter((entry): entry is { link: ProjectPatternRecord; project: ProjectRecord } => entry !== null)
  const candidateProjects = context.projects.filter((project) => !links.some((link) => link.projectId === project.id))
  const allTags = Array.from(new Set(context.patterns.flatMap((candidate) => candidate.tags))).sort((a, b) => a.localeCompare(b))

  return (
    <div className={layoutStyles.shell}>
      <FloatingTabBar />
      <div className={layoutStyles.main}>
        <div className={layoutStyles.content}>
          <div className={styles.hero}>
            <div className={styles.topBar}>
              <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" className={styles.heroIconButton} onClick={() => navigate('/patrons')} />
            </div>
            <div className={coverUrl ? styles.cover : `${styles.cover} ${styles.coverFallback}`} style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}>
              {!coverUrl && <BookOpen size={48} strokeWidth={1.5} />}
            </div>
            <button type="button" className={styles.changeCoverButton} onClick={() => coverInputRef.current?.click()}>
              <Image size={16} strokeWidth={1.75} />
              Changer la couverture
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              onChange={(event) => void handleCoverChange(event.target.files?.[0])}
            />
            {photoError && <p className={styles.error}>{photoError}</p>}
          </div>
          <WaveDivider />

          <div className={styles.body}>
            <Button size="lg" onClick={() => navigate(`/patrons/${patternId}/lire`)}>
              Ouvrir
            </Button>

            <div className={styles.section}>
              <label className={styles.field}>
                <span className={styles.label}>Nom</span>
                <input
                  className={styles.input}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    scheduleMetaSave({ name: event.target.value })
                  }}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Type</span>
                <select
                  className={styles.input}
                  value={craft}
                  onChange={(event) => {
                    const value = event.target.value as ProjectCraft | ''
                    setCraft(value)
                    scheduleMetaSave({ craft: value })
                  }}
                >
                  <option value="">—</option>
                  <option value="knitting">{CRAFT_LABELS.knitting}</option>
                  <option value="crochet">{CRAFT_LABELS.crochet}</option>
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Source</span>
                <input
                  className={styles.input}
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value)
                    scheduleMetaSave({ source: event.target.value })
                  }}
                  placeholder="Créatrice, site…"
                />
              </label>
              <div className={styles.field}>
                <span className={styles.label}>Tags</span>
                <TagEditor tags={pattern.tags} onChange={(tags) => void handleTagsChange(tags)} allTags={allTags} />
              </div>
              <label className={styles.field}>
                <span className={styles.label}>Notes</span>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value)
                    scheduleMetaSave({ notes: event.target.value })
                  }}
                />
              </label>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoRow}>
                <span>Pages</span>
                <span>{pattern.pageCount}</span>
              </div>
              <div className={styles.infoRow}>
                <span>Taille du fichier</span>
                <span>{formatFileSize(pattern.sizeBytes)}</span>
              </div>
              <div className={styles.infoRow}>
                <span>Version</span>
                <span>v{pattern.fileVersion}</span>
              </div>
              <button type="button" className={styles.replaceButton} onClick={() => fileInputRef.current?.click()} disabled={replacing}>
                <RefreshCw size={16} strokeWidth={1.75} />
                {replacing ? 'Remplacement…' : 'Remplacer le fichier'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className={styles.hiddenInput}
                onChange={(event) => void handleReplaceFile(event.target.files?.[0])}
              />
              {replaceError && <p className={styles.error}>{replaceError}</p>}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Projets liés</h2>
                <IconButton icon={<Plus strokeWidth={1.75} />} label="Associer à un projet" onClick={() => setAssociateOpen(true)} />
              </div>
              {linkedProjects.length === 0 ? (
                <p className={styles.emptyText}>Ce patron n'est associé à aucun projet.</p>
              ) : (
                <div className={styles.linkedList}>
                  {linkedProjects.map(({ link, project }) => (
                    <div key={link.id} className={styles.linkedItem}>
                      <Link to={`/projets/${project.id}`}>{project.name}</Link>
                      <button type="button" className={styles.unlinkButton} onClick={() => void unlinkPatternFromProject(link.id)}>
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button variant="ghost" className={styles.deleteButton} icon={<Trash2 size={18} strokeWidth={1.75} />} onClick={() => setDeleteConfirmOpen(true)}>
              Supprimer le patron
            </Button>
          </div>
        </div>
      </div>

      <AssociateProjectSheet open={associateOpen} onClose={() => setAssociateOpen(false)} patternId={patternId} candidates={candidateProjects} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer le patron"
        message={
          linkedProjects.length > 0
            ? `Ce patron est associé à : ${linkedProjects.map(({ project }) => project.name).join(', ')}. Le supprimer retire aussi ces liens et sa position de lecture. Cette action est irréversible.`
            : 'Cette action supprime le fichier, sa couverture et sa position de lecture. Elle est irréversible.'
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}
