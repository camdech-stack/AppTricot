import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import styles from './ImportPatternSheet.module.css'
import { Sheet, Button, ConfirmDialog } from '../ui'
import { TagEditor } from './TagEditor'
import { CRAFT_LABELS } from '../projects/statusMeta'
import { extractPdfMetadata, PdfReadError, type PdfMetadata } from '../../pdf/extractPdfMetadata'
import {
  defaultPatternName,
  findPatternByHash,
  hashBytes,
  importPattern,
  PATTERN_SIZE_WARNING_BYTES,
  pdfValidationMessage,
  validatePdfSignature,
  type PatternRecord,
  type ProjectCraft,
} from '../../data'

interface ImportPatternSheetProps {
  open: boolean
  onClose: () => void
  onImported: (pattern: PatternRecord) => void
  allTags: string[]
}

type FileStatus = 'ready' | 'duplicate' | 'invalid' | 'password' | 'error' | 'imported'

interface ProcessedFile {
  file: File
  status: FileStatus
  message?: string
  bytes?: ArrayBuffer
  hash?: string
  metadata?: PdfMetadata
  duplicateOf?: PatternRecord
}

type Step = 'pick' | 'processing' | 'single-form' | 'multi-result'

// Prefixes the auto-detected needle/hook lines so it's obvious in Notes
// that they came from a heuristic scan, not something the user typed —
// see CLAUDE.md "Extraction heuristique".
function formatMaterialsHint(materialsHint: string[]): string {
  if (materialsHint.length === 0) return ''
  return ['Matériel détecté dans le PDF :', ...materialsHint.map((line) => `- ${line}`)].join('\n')
}

async function processFile(file: File): Promise<ProcessedFile> {
  const bytes = await file.arrayBuffer()
  const signatureError = validatePdfSignature(bytes)
  if (signatureError) {
    return { file, status: 'invalid', message: pdfValidationMessage(signatureError) }
  }

  const hash = await hashBytes(bytes)
  const duplicateOf = await findPatternByHash(hash)
  if (duplicateOf) {
    return { file, status: 'duplicate', bytes, hash, duplicateOf }
  }

  try {
    const metadata = await extractPdfMetadata(bytes)
    return { file, status: 'ready', bytes, hash, metadata }
  } catch (error) {
    if (error instanceof PdfReadError && error.reason === 'password') {
      return { file, status: 'password', message: error.message }
    }
    return { file, status: 'error', message: error instanceof Error ? error.message : 'Échec de la lecture du PDF.' }
  }
}

export function ImportPatternSheet({ open, onClose, onImported, allTags }: ImportPatternSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [dragOver, setDragOver] = useState(false)
  const [processed, setProcessed] = useState<ProcessedFile[]>([])
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false)

  // Single-file form state.
  const [name, setName] = useState('')
  const [craft, setCraft] = useState<ProjectCraft | ''>('')
  const [tags, setTags] = useState<string[]>([])
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setStep('pick')
    setProcessed([])
    setDuplicateConfirmOpen(false)
    setName('')
    setCraft('')
    setTags([])
    setSource('')
    setNotes('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFilesPicked(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    if (files.length === 0) return

    setStep('processing')
    const results = await Promise.all(files.map(processFile))
    setProcessed(results)

    if (results.length === 1) {
      const only = results[0]!
      if (only.status === 'duplicate') {
        setDuplicateConfirmOpen(true)
        setStep('single-form')
        return
      }
      if (only.status === 'ready' && only.metadata) {
        setName(only.metadata.title ?? defaultPatternName(only.file.name))
        setSource(only.metadata.creator ?? '')
        setNotes(formatMaterialsHint(only.metadata.materialsHint))
        setStep('single-form')
        return
      }
      // invalid/password/error: stay on a result step showing the message.
      setStep('multi-result')
      return
    }

    await importReadyFiles(results)
    setStep('multi-result')
  }

  async function importReadyFiles(files: ProcessedFile[]) {
    const updated = [...files]
    for (let index = 0; index < updated.length; index += 1) {
      const entry = updated[index]!
      if (entry.status !== 'ready' || !entry.bytes || !entry.hash || !entry.metadata) continue
      try {
        await importPattern({
          name: entry.metadata.title ?? defaultPatternName(entry.file.name),
          craft: null,
          source: entry.metadata.creator ?? '',
          notes: formatMaterialsHint(entry.metadata.materialsHint),
          fileName: entry.file.name,
          fileHash: entry.hash,
          pageCount: entry.metadata.pageCount,
          sizeBytes: entry.file.size,
          fileBlob: new Blob([entry.bytes], { type: 'application/pdf' }),
          coverBlob: entry.metadata.coverBlob,
        })
        updated[index] = { ...entry, status: 'imported' }
      } catch (error) {
        updated[index] = {
          ...entry,
          status: 'error',
          message: error instanceof Error ? error.message : "Échec de l'enregistrement.",
        }
      }
    }
    setProcessed(updated)
  }

  async function handleSingleSave() {
    const only = processed[0]
    if (!only || !only.bytes || !only.hash || !only.metadata || saving) return
    if (!name.trim()) return
    setSaving(true)
    try {
      const pattern = await importPattern({
        name: name.trim(),
        craft: craft || null,
        tags,
        source,
        notes,
        fileName: only.file.name,
        fileHash: only.hash,
        pageCount: only.metadata.pageCount,
        sizeBytes: only.file.size,
        fileBlob: new Blob([only.bytes], { type: 'application/pdf' }),
        coverBlob: only.metadata.coverBlob,
      })
      reset()
      onImported(pattern)
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'QuotaExceededError'
          ? "Espace de stockage insuffisant pour enregistrer ce patron. Libère de l'espace et réessaie."
          : "Échec de l'enregistrement du patron."
      setProcessed([{ ...only, status: 'error', message }])
      setStep('multi-result')
    } finally {
      setSaving(false)
    }
  }

  async function handleImportDuplicateAnyway() {
    const only = processed[0]
    setDuplicateConfirmOpen(false)
    if (!only) return
    if (!only.bytes || !only.hash) return
    try {
      const metadata = await extractPdfMetadata(only.bytes)
      setName(metadata.title ?? defaultPatternName(only.file.name))
      setSource(metadata.creator ?? '')
      setNotes(formatMaterialsHint(metadata.materialsHint))
      setProcessed([{ ...only, status: 'ready', metadata }])
    } catch (error) {
      const message = error instanceof PdfReadError ? error.message : 'Échec de la lecture du PDF.'
      setProcessed([{ ...only, status: 'error', message }])
      setStep('multi-result')
    }
  }

  const only = processed.length === 1 ? processed[0] : undefined
  const oversized = only?.file && only.file.size > PATTERN_SIZE_WARNING_BYTES

  return (
    <>
      <Sheet open={open} onClose={handleClose} title="Importer un patron">
        {step === 'pick' && (
          <div
            className={dragOver ? `${styles.dropzone} ${styles.dropzoneActive}` : styles.dropzone}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              void handleFilesPicked(event.dataTransfer.files)
            }}
          >
            <Upload size={32} strokeWidth={1.5} />
            <p>Dépose un ou plusieurs PDF ici, ou</p>
            <Button type="button" onClick={() => inputRef.current?.click()}>
              Choisir des fichiers
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              className={styles.hiddenInput}
              onChange={(event) => void handleFilesPicked(event.target.files)}
            />
          </div>
        )}

        {step === 'processing' && <p className={styles.status}>Lecture du ou des fichiers…</p>}

        {step === 'single-form' && only?.status === 'ready' && only.metadata && (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              void handleSingleSave()
            }}
          >
            {oversized && <p className={styles.warning}>Ce fichier dépasse 100 Mo : l'import peut prendre du temps.</p>}
            <label className={styles.field}>
              <span className={styles.label}>Nom</span>
              <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Type</span>
              <select className={styles.input} value={craft} onChange={(event) => setCraft(event.target.value as ProjectCraft | '')}>
                <option value="">—</option>
                <option value="knitting">{CRAFT_LABELS.knitting}</option>
                <option value="crochet">{CRAFT_LABELS.crochet}</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Source</span>
              <input className={styles.input} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Créatrice, site…" />
            </label>
            <div className={styles.field}>
              <span className={styles.label}>Tags</span>
              <TagEditor tags={tags} onChange={setTags} allTags={allTags} />
            </div>
            <label className={styles.field}>
              <span className={styles.label}>Notes</span>
              <textarea className={styles.textarea} value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </label>
            <Button type="submit" size="lg" disabled={saving || !name.trim()}>
              {saving ? 'Enregistrement…' : 'Enregistrer le patron'}
            </Button>
          </form>
        )}

        {step === 'multi-result' && (
          <div className={styles.resultList}>
            {processed.map((entry, index) => (
              <div key={`${entry.file.name}-${index}`} className={styles.resultRow}>
                <span className={styles.resultName}>{entry.file.name}</span>
                <span className={resultBadgeClass(entry.status, styles)}>{resultLabel(entry)}</span>
              </div>
            ))}
            <Button onClick={handleClose}>Terminé</Button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={duplicateConfirmOpen}
        title="Fichier déjà présent"
        message={`Ce fichier est déjà dans ta bibliothèque : "${only?.duplicateOf?.name ?? ''}". Importer quand même ?`}
        confirmLabel="Importer quand même"
        onConfirm={() => void handleImportDuplicateAnyway()}
        onCancel={handleClose}
      />
    </>
  )
}

function resultLabel(entry: ProcessedFile): string {
  switch (entry.status) {
    case 'imported':
      return 'Importé'
    case 'duplicate':
      return `Déjà dans la bibliothèque : ${entry.duplicateOf?.name ?? ''}`
    case 'password':
      return 'Protégé par mot de passe'
    case 'invalid':
      return entry.message ?? 'Fichier invalide'
    case 'error':
      return entry.message ?? 'Échec'
    default:
      return '…'
  }
}

function resultBadgeClass(status: FileStatus, styles: Record<string, string>): string {
  return (status === 'imported' ? styles.resultOk : styles.resultProblem) ?? ''
}
