import { useRef, useState, type DragEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CircleHelp } from 'lucide-react'
import styles from '../components/guides/import/GuideImport.module.css'
import { Button, IconButton, Pill } from '../components/ui'
import { GuidePreviewTree } from '../components/guides/import/GuidePreviewTree'
import { ImportHelpSheet } from '../components/guides/import/ImportHelpSheet'
import { CRAFT_LABELS } from '../components/projects/statusMeta'
import { useGuideLibraryContext } from '../hooks/useGuideLibraryContext'
import {
  analyzeGuideImport,
  byteLength,
  createGuide,
  formatMegabytes,
  guideNameFromFileName,
  MAX_GUIDE_IMPORT_BYTES,
  type GuideContent,
  type GuideImportAnalysis,
  type ProjectCraft,
} from '../data'

interface ImportLocationState {
  returnTo?: string
  // Set when coming from a pattern's own page.
  patternId?: string
}

// Everything in this page is local: the JSON comes from a file picker or the
// clipboard, is validated in memory and stored in IndexedDB. No network.
export function GuideImportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as ImportLocationState | null) ?? {}
  const returnTo = state.returnTo ?? '/patrons?vue=guides'
  const context = useGuideLibraryContext()

  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<GuideImportAnalysis | null>(null)
  const [repairAccepted, setRepairAccepted] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [craft, setCraft] = useState<ProjectCraft | ''>('')
  const [patternId, setPatternId] = useState<string | null>(state.patternId ?? null)
  const [sizeLabel, setSizeLabel] = useState('')

  const patterns = context?.patterns ?? []

  function runAnalysis(source: string, sourceFileName: string | null) {
    const result = analyzeGuideImport(source)
    setAnalysis(result)
    setRepairAccepted(false)
    setCopied(null)
    setSaveError(undefined)
    if (result.status === 'invalid') return
    const linkedPattern = patterns.find((pattern) => pattern.id === patternId)
    setName(result.hints.name || (sourceFileName ? guideNameFromFileName(sourceFileName) : '') || linkedPattern?.name || '')
    setCraft(result.hints.craft ?? linkedPattern?.craft ?? '')
    setSizeLabel(result.hints.sizeLabel ?? '')
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_GUIDE_IMPORT_BYTES) {
      setFileName(file.name)
      setAnalysis({
        status: 'invalid',
        errors: [`Le fichier est trop volumineux (${formatMegabytes(file.size)}, maximum ${formatMegabytes(MAX_GUIDE_IMPORT_BYTES)}).`],
        technical: `Fichier trop volumineux : ${file.size} octets.`,
      })
      return
    }
    try {
      const content = await file.text()
      setText(content)
      setFileName(file.name)
      runAnalysis(content, file.name)
    } catch {
      setAnalysis({ status: 'invalid', errors: ['Impossible de lire ce fichier.'], technical: 'Lecture du fichier impossible.' })
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    void handleFile(event.dataTransfer.files[0])
  }

  async function copyTechnical(detail: string) {
    try {
      await navigator.clipboard.writeText(detail)
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
  }

  async function handleImport(content: GuideContent) {
    if (!name.trim() || saving) return
    setSaving(true)
    setSaveError(undefined)
    try {
      const guide = await createGuide({
        name: name.trim(),
        craft: craft || null,
        patternId,
        sizeLabel: sizeLabel.trim() || null,
        content,
      })
      navigate(`/guides/${guide.id}`, { state: { returnTo }, replace: true })
    } catch {
      setSaveError('L’import a échoué : rien n’a été créé. Vérifie l’espace de stockage de l’appareil et réessaie.')
      setSaving(false)
    }
  }

  const readyContent: GuideContent | null =
    analysis && (analysis.status === 'valid' || (analysis.status === 'repairable' && repairAccepted)) ? analysis.content : null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={() => navigate(returnTo)} />
        <h1 className={styles.title}>Importer un guide</h1>
        <Button variant="ghost" size="sm" icon={<CircleHelp size={18} strokeWidth={1.75} />} onClick={() => setHelpOpen(true)}>
          Comment ça marche ?
        </Button>
      </div>

      <div className={styles.body}>
        {analysis === null ? (
          <>
            <div
              className={[styles.dropZone, dragging ? styles.dropZoneActive : undefined].filter(Boolean).join(' ')}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <Button onClick={() => inputRef.current?.click()}>Choisir un fichier .json</Button>
              <p className={styles.muted}>Sur ordinateur ou iPad, tu peux aussi le glisser ici.</p>
              <input
                ref={inputRef}
                type="file"
                accept=".json,application/json,text/plain"
                className={styles.visuallyHidden}
                onChange={(event) => {
                  void handleFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="guide-json">
                Ou colle le texte JSON ici
              </label>
              <textarea
                id="guide-json"
                className={styles.textarea}
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                  setFileName(null)
                }}
                placeholder='{ "schemaVersion": 1, "pieces": [ … ] }'
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
              {byteLength(text) > MAX_GUIDE_IMPORT_BYTES && <p className={styles.muted}>Ce texte dépasse {formatMegabytes(MAX_GUIDE_IMPORT_BYTES)} : il sera refusé.</p>}
              <Button size="lg" disabled={!text.trim()} onClick={() => runAnalysis(text, fileName)}>
                Vérifier
              </Button>
              <p className={styles.muted}>Rien n’est créé avant que tu aies vu l’aperçu et confirmé.</p>
            </div>
          </>
        ) : (
          <>
            <div className={styles.actions}>
              <Button variant="secondary" size="sm" onClick={() => setAnalysis(null)}>
                Changer le contenu
              </Button>
            </div>

            {analysis.status === 'invalid' && (
              <div className={`${styles.panel} ${styles.panelDanger}`}>
                <h2 className={styles.panelTitle}>Ce guide ne peut pas être importé</h2>
                <ul className={styles.list}>
                  {analysis.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
                <div className={styles.actions}>
                  <Button variant="secondary" size="sm" onClick={() => void copyTechnical(analysis.technical)}>
                    Copier le détail technique
                  </Button>
                </div>
                {copied === 'ok' && <p className={styles.muted}>Détail copié.</p>}
                {copied === 'failed' && <p className={styles.muted}>Copie impossible sur cet appareil : sélectionne le texte à la main.</p>}
              </div>
            )}

            {analysis.status === 'repairable' && !repairAccepted && (
              <div className={`${styles.panel} ${styles.panelWarn}`}>
                <h2 className={styles.panelTitle}>Quelques corrections sont nécessaires</h2>
                <p className={styles.muted}>Voici ce qui ne respecte pas le format. L’app peut le corriger automatiquement, rien ne change sans ton accord.</p>
                <ul className={styles.list}>
                  {analysis.corrections.map((correction, index) => (
                    <li key={index}>{correction}</li>
                  ))}
                </ul>
                {analysis.removesContent && <p className={styles.muted}>Attention : certains éléments inutilisables seront supprimés lors de la correction.</p>}
                <div className={styles.actions}>
                  <Button size="sm" onClick={() => setRepairAccepted(true)}>
                    Appliquer les corrections
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void copyTechnical(analysis.technical)}>
                    Copier le détail technique
                  </Button>
                </div>
                {copied === 'ok' && <p className={styles.muted}>Détail copié.</p>}
                {copied === 'failed' && <p className={styles.muted}>Copie impossible sur cet appareil : sélectionne le texte à la main.</p>}
              </div>
            )}

            {analysis.status !== 'invalid' && (analysis.notes.length > 0 || repairAccepted) && (
              <div className={styles.panel}>
                {repairAccepted && analysis.status === 'repairable' && <p className={styles.muted}>{analysis.corrections.length} correction(s) appliquée(s).</p>}
                {analysis.notes.map((note, index) => (
                  <p key={index} className={styles.muted}>
                    {note}
                  </p>
                ))}
              </div>
            )}

            {readyContent && analysis.status !== 'invalid' && (
              <>
                <div className={styles.stats}>
                  <Pill color="primary">
                    {analysis.stats.pieceCount} pièce{analysis.stats.pieceCount > 1 ? 's' : ''}
                  </Pill>
                  <Pill color="gold">
                    {analysis.stats.sectionCount} section{analysis.stats.sectionCount > 1 ? 's' : ''}
                  </Pill>
                  <Pill color="sage">
                    {analysis.stats.blockCount} bloc{analysis.stats.blockCount > 1 ? 's' : ''}
                  </Pill>
                  <Pill color="blue">
                    {analysis.stats.knownRows} rang{analysis.stats.knownRows > 1 ? 's' : ''}
                    {analysis.stats.hasVariableLength ? ' + longueur variable' : ''}
                  </Pill>
                </div>

                <GuidePreviewTree content={readyContent} />

                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleImport(readyContent)
                  }}
                >
                  <label className={styles.field}>
                    <span className={styles.label}>Nom</span>
                    <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="Pull torsades" required />
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
                    <span className={styles.label}>Patron associé (optionnel)</span>
                    <select className={styles.input} value={patternId ?? ''} onChange={(event) => setPatternId(event.target.value || null)}>
                      <option value="">Aucun patron</option>
                      {patterns.map((pattern) => (
                        <option key={pattern.id} value={pattern.id}>
                          {pattern.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Taille (optionnel)</span>
                    <input className={styles.input} value={sizeLabel} onChange={(event) => setSizeLabel(event.target.value)} placeholder="M" />
                  </label>

                  {saveError && <p className={styles.muted}>{saveError}</p>}
                  <Button type="submit" size="lg" disabled={saving || !name.trim()}>
                    {saving ? 'Import…' : 'Importer'}
                  </Button>
                </form>
              </>
            )}
          </>
        )}
      </div>

      <ImportHelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
