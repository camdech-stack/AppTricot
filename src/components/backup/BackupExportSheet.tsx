import styles from './Backup.module.css'
import { Button, Sheet, StripedProgressBar } from '../ui'
import { formatFileSize } from '../../utils/formatFileSize'
import type { BackupExport } from '../../hooks/useBackupExport'

const DESTINATION_TEXT = {
  shared: 'Le fichier a été transmis via le partage de ton appareil.',
  downloaded: 'Le fichier a été téléchargé. Retrouve-le dans tes téléchargements ou dans l’app Fichiers.',
} as const

// The honest part: this sheet only claims what really happened.
export function BackupExportSheet({ backup }: { backup: BackupExport }) {
  const { state } = backup
  const open = state.phase !== 'idle'
  const working = state.phase === 'working'

  return (
    <Sheet open={open} onClose={() => !working && backup.reset()} title="Sauvegarde">
      {state.phase === 'working' && (
        <div className={styles.stack}>
          <p className={styles.text}>Préparation du fichier de sauvegarde… Garde l’app ouverte.</p>
          <StripedProgressBar progress={state.percent / 100} label="Progression de la sauvegarde" />
          <p className={styles.muted}>{state.percent} %</p>
        </div>
      )}

      {state.phase === 'ready' && (
        <div className={styles.stack}>
          <p className={styles.text}>
            Le fichier est prêt ({formatFileSize(state.file.size)}). {state.needsTap
              ? 'Ton navigateur demande un dernier appui pour l’enregistrer ou le partager.'
              : 'Il n’est pas encore enregistré.'}
          </p>
          {state.notice && <p className={styles.muted}>{state.notice}</p>}
          <Button onClick={backup.deliverAgain}>Enregistrer / partager</Button>
          <Button variant="ghost" onClick={backup.reset}>
            Annuler
          </Button>
        </div>
      )}

      {state.phase === 'done' && (
        <div className={styles.stack}>
          <p className={styles.successTitle}>Sauvegarde terminée</p>
          <p className={styles.text}>
            {formatFileSize(state.sizeBytes)} · {state.itemCount} élément{state.itemCount > 1 ? 's' : ''} et{' '}
            {state.fileCount} fichier{state.fileCount > 1 ? 's' : ''} (PDF, photos).
          </p>
          <p className={styles.muted}>
            {state.destination === 'folder'
              ? `Écrite dans le dossier « ${state.folderName ?? ''} » : ${state.fileName}`
              : `${DESTINATION_TEXT[state.destination]} (${state.fileName})`}
          </p>
          <p className={styles.muted}>
            Pense à garder ce fichier hors de l’appareil (iCloud Drive, ordinateur) : c’est lui qui te protège si l’appareil est perdu.
          </p>
          <Button onClick={backup.reset}>Terminé</Button>
        </div>
      )}

      {state.phase === 'error' && (
        <div className={styles.stack}>
          <p className={styles.errorText}>{state.message}</p>
          <Button variant="secondary" onClick={backup.reset}>
            Fermer
          </Button>
        </div>
      )}
    </Sheet>
  )
}
