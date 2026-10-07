import { useRef, useState, type DragEvent } from 'react'
import styles from './Backup.module.css'
import { Button, ConfirmDialog, Sheet, StripedProgressBar } from '../ui'
import {
  BackupError,
  countCurrentData,
  openBackup,
  restoreBackup,
  type OpenedBackup,
  type RestoreMode,
  type RestoreReport,
} from '../../data'
import { formatDateFr } from '../../utils/formatDate'

type Step =
  | { name: 'pick' }
  | { name: 'reading' }
  | { name: 'preview'; opened: OpenedBackup; current: Awaited<ReturnType<typeof countCurrentData>>; mode: RestoreMode }
  | { name: 'restoring'; percent: number }
  | { name: 'done'; report: RestoreReport }
  | { name: 'error'; message: string }

const TABLE_LABELS: Record<string, string> = {
  projects: 'projets',
  counters: 'compteurs',
  counterEvents: 'événements de compteur',
  coverImages: 'photos de projet',
  sessions: 'sessions',
  yarns: 'fils',
  yarnImages: 'photos de fils',
  projectYarns: 'liens projet-fil',
  yarnUsages: 'consommations de laine',
  patterns: 'patrons',
  patternFiles: 'fichiers PDF',
  patternCovers: 'couvertures de patrons',
  projectPatterns: 'liens projet-patron',
  patternViewStates: 'positions de lecture',
  guides: 'guides',
  guideContents: 'contenus de guides',
  projectGuides: 'liens projet-guide',
  guideProgress: 'progressions de guide',
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`
}

function formatExportedAt(iso: string): string {
  return formatDateFr(iso.slice(0, 10))
}

function describeCounts(counts: Partial<Record<string, number>>): string[] {
  return Object.entries(counts)
    .filter(([name, count]) => name in TABLE_LABELS && (count ?? 0) > 0)
    .map(([name, count]) => `${count} ${TABLE_LABELS[name]}`)
}

interface ImportBackupSheetProps {
  open: boolean
  onClose: () => void
}

export function ImportBackupSheet({ open, onClose }: ImportBackupSheetProps) {
  const [step, setStep] = useState<Step>({ name: 'pick' })
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = step.name === 'reading' || step.name === 'restoring'

  function close() {
    if (busy) return
    setStep({ name: 'pick' })
    setConfirmReplace(false)
    onClose()
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setStep({ name: 'reading' })
    try {
      const [opened, current] = await Promise.all([openBackup(file), countCurrentData()])
      // Replacing is the natural default on an (almost) empty app; otherwise
      // merging is offered first because it can never destroy anything.
      const almostEmpty = current.projects + current.patterns + current.yarns + current.guides === 0
      setStep({ name: 'preview', opened, current, mode: almostEmpty ? 'replace' : 'merge' })
    } catch (error) {
      setStep({
        name: 'error',
        message: error instanceof BackupError ? error.message : "Impossible de lire ce fichier. Rien n'a été modifié.",
      })
    }
  }

  async function runRestore(opened: OpenedBackup, mode: RestoreMode) {
    setConfirmReplace(false)
    setStep({ name: 'restoring', percent: 0 })
    try {
      const report = await restoreBackup(opened, mode, ({ done, total }) =>
        setStep({ name: 'restoring', percent: total === 0 ? 100 : Math.round((done / total) * 100) }),
      )
      setStep({ name: 'done', report })
    } catch (error) {
      setStep({
        name: 'error',
        message: error instanceof BackupError ? error.message : 'La restauration a échoué.',
      })
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    void handleFile(event.dataTransfer.files[0])
  }

  return (
    <Sheet open={open} onClose={close} title="Importer une sauvegarde">
      {step.name === 'pick' && (
        <div className={styles.stack}>
          <div
            className={[styles.dropZone, dragging ? styles.dropZoneActive : undefined].filter(Boolean).join(' ')}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <p className={styles.text}>Choisis le fichier .zip créé par « Exporter mes données ».</p>
            <Button onClick={() => inputRef.current?.click()}>Choisir un fichier</Button>
            <p className={styles.muted}>Sur ordinateur ou iPad, tu peux aussi le glisser ici.</p>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className={styles.visuallyHidden}
              onChange={(event) => {
                void handleFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>
          <p className={styles.muted}>Rien n’est modifié avant que tu aies vu le contenu et confirmé.</p>
        </div>
      )}

      {step.name === 'reading' && <p className={styles.text}>Vérification de la sauvegarde…</p>}

      {step.name === 'preview' && (
        <div className={styles.stack}>
          <p className={styles.text}>
            Cette sauvegarde contient {plural(step.opened.summary.projects, 'projet', 'projets')},{' '}
            {plural(step.opened.summary.patterns, 'patron', 'patrons')}, {plural(step.opened.summary.yarns, 'fil', 'fils')}{' '}
            et {plural(step.opened.summary.guides, 'guide', 'guides')}, datée du {formatExportedAt(step.opened.summary.exportedAt)}.
          </p>
          {step.opened.migrated && (
            <p className={styles.infoBox}>Cette sauvegarde vient d’une version plus ancienne de l’app : ses données seront mises à jour automatiquement.</p>
          )}
          <button
            type="button"
            className={styles.modeOption}
            aria-pressed={step.mode === 'merge'}
            onClick={() => setStep({ ...step, mode: 'merge' })}
          >
            <span>
              <span className={styles.modeTitle}>Fusionner</span>
              <span className={styles.modeDescription}>
                Ajoute ce qui n’existe pas encore. Ce qui est déjà dans l’app n’est jamais modifié.
              </span>
            </span>
          </button>
          <button
            type="button"
            className={styles.modeOption}
            aria-pressed={step.mode === 'replace'}
            onClick={() => setStep({ ...step, mode: 'replace' })}
          >
            <span>
              <span className={styles.modeTitle}>Remplacer tout</span>
              <span className={styles.modeDescription}>Vide l’app, puis la remplit avec cette sauvegarde.</span>
            </span>
          </button>
          <div className={styles.actions}>
            <Button variant="ghost" onClick={close}>
              Annuler
            </Button>
            <Button
              onClick={() => (step.mode === 'replace' && step.current.total > 0 ? setConfirmReplace(true) : void runRestore(step.opened, step.mode))}
            >
              {step.mode === 'replace' ? 'Remplacer tout' : 'Fusionner'}
            </Button>
          </div>
          <ConfirmDialog
            open={confirmReplace}
            danger
            title="Remplacer toutes les données ?"
            message={`Ceci supprime définitivement ce qui est actuellement dans l’app (${plural(step.current.projects, 'projet', 'projets')}, ${plural(step.current.patterns, 'patron', 'patrons')}, ${plural(step.current.yarns, 'fil', 'fils')}, ${plural(step.current.guides, 'guide', 'guides')} et tout ce qui s’y rattache : ${plural(step.current.total, 'enregistrement', 'enregistrements')} au total) pour le remplacer par la sauvegarde. Cette action est irréversible.`}
            confirmLabel="Oui, tout remplacer"
            onCancel={() => setConfirmReplace(false)}
            onConfirm={() => void runRestore(step.opened, 'replace')}
          />
        </div>
      )}

      {step.name === 'restoring' && (
        <div className={styles.stack}>
          <p className={styles.text}>Restauration en cours… Garde l’app ouverte.</p>
          <StripedProgressBar progress={step.percent / 100} label="Progression de la restauration" />
        </div>
      )}

      {step.name === 'done' && (
        <div className={styles.stack}>
          <p className={styles.successTitle}>{step.report.mode === 'replace' ? 'Données restaurées' : 'Fusion terminée'}</p>
          <p className={styles.text}>
            Ajouté : {describeCounts(step.report.added).join(', ') || 'rien'}.
          </p>
          {step.report.mode === 'merge' && describeCounts(step.report.ignored).length > 0 && (
            <p className={styles.muted}>
              Déjà présent, laissé tel quel : {describeCounts(step.report.ignored).join(', ')}.
            </p>
          )}
          {step.report.warnings.map((warning) => (
            <p key={warning} className={styles.warningBox}>
              {warning}
            </p>
          ))}
          {step.report.ravelryCredentialsNeeded && (
            <p className={styles.infoBox}>
              Les identifiants Ravelry ne sont jamais sauvegardés : ressaisis-les dans la section « Catalogue Ravelry » si tu veux réutiliser la recherche de fils.
            </p>
          )}
          {!step.report.persistentStorage && (
            <p className={styles.infoBox}>
              Le stockage persistant n’est pas activé : active-le dans la section « Stockage » pour que le système ne supprime pas tes données.
            </p>
          )}
          <Button onClick={close}>Terminé</Button>
        </div>
      )}

      {step.name === 'error' && (
        <div className={styles.stack}>
          <p className={styles.errorText}>{step.message}</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setStep({ name: 'pick' })}>
              Choisir un autre fichier
            </Button>
            <Button variant="ghost" onClick={close}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
