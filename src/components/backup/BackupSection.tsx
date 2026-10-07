import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import settingsStyles from '../../pages/SettingsPage.module.css'
import { Button } from '../ui'
import { BackupExportSheet } from './BackupExportSheet'
import { ImportBackupSheet } from './ImportBackupSheet'
import { useBackupExport } from '../../hooks/useBackupExport'
import { useRelativeTime } from '../../hooks/useRelativeTime'
import { useSettings } from '../../hooks/useSettings'
import {
  BACKUP_REMINDER_INTERVALS,
  chooseBackupFolder,
  clearBackupFolder,
  estimateBackupBytes,
  getBackupFolder,
  isBackupFolderSupported,
  updateSettings,
  type BackupDirectoryHandle,
  type BackupReminderInterval,
} from '../../data'
import { formatFileSize } from '../../utils/formatFileSize'

const INTERVAL_LABELS = new Map<BackupReminderInterval, string>([
  [7, '7 jours'],
  [14, '14 jours'],
  [30, '30 jours'],
  [null, 'Jamais'],
])

export function BackupSection() {
  const settings = useSettings()
  const backup = useBackupExport()
  const [importOpen, setImportOpen] = useState(false)
  const [folder, setFolder] = useState<BackupDirectoryHandle | null>(null)
  const folderSupported = isBackupFolderSupported()
  const estimate = useLiveQuery(() => estimateBackupBytes(), [])
  const lastBackup = useRelativeTime(settings?.lastBackupAt)

  useEffect(() => {
    if (folderSupported) void getBackupFolder().then(setFolder)
  }, [folderSupported])

  async function handleChooseFolder() {
    const chosen = await chooseBackupFolder()
    if (chosen) setFolder(chosen)
  }

  async function handleClearFolder() {
    await clearBackupFolder()
    setFolder(null)
  }

  const interval = settings?.backupReminderIntervalDays ?? 14

  return (
    <section className={settingsStyles.section}>
      <div className={settingsStyles.sectionTitle}>Sauvegarde</div>
      <div className={settingsStyles.card}>
        <div className={settingsStyles.row}>
          <span className={settingsStyles.rowLabel}>Dernière sauvegarde</span>
          <span className={settingsStyles.rowValue}>{settings?.lastBackupAt ? lastBackup : 'Jamais'}</span>
        </div>
        <div className={settingsStyles.row}>
          <Button onClick={backup.start}>Exporter mes données</Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Importer une sauvegarde
          </Button>
        </div>
        <p className={settingsStyles.helperText}>
          Crée un fichier .zip avec tes projets, patrons PDF, photos, guides, laine et réglages
          {estimate ? ` (environ ${formatFileSize(estimate)})` : ''}. Sur iPhone et iPad, l’app ne peut pas
          écrire de fichier toute seule en arrière-plan : à chaque sauvegarde, tu confirmes le partage ou
          l’enregistrement, et c’est tout. Garde ensuite le fichier hors de l’appareil, par exemple dans iCloud Drive.
          Les identifiants Ravelry ne sont jamais inclus.
        </p>
      </div>

      <div className={settingsStyles.card} style={{ marginTop: 'var(--space-12)' }}>
        <div className={settingsStyles.row}>
          <span className={settingsStyles.rowLabel}>Rappel de sauvegarde</span>
          <button
            type="button"
            className={settingsStyles.toggle}
            role="switch"
            aria-checked={settings?.backupReminderEnabled ?? true}
            aria-label="Activer le rappel de sauvegarde"
            onClick={() => updateSettings({ backupReminderEnabled: !(settings?.backupReminderEnabled ?? true) })}
          >
            <span className={settingsStyles.toggleThumb} />
          </button>
        </div>
        {(settings?.backupReminderEnabled ?? true) && (
          <div className={settingsStyles.row}>
            <span className={settingsStyles.rowLabel}>Me le rappeler tous les</span>
            <div className={settingsStyles.segmented} role="group" aria-label="Fréquence du rappel">
              {BACKUP_REMINDER_INTERVALS.map((option) => (
                <button
                  key={String(option)}
                  type="button"
                  aria-pressed={interval === option}
                  onClick={() => updateSettings({ backupReminderIntervalDays: option })}
                >
                  {INTERVAL_LABELS.get(option)}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className={settingsStyles.helperText}>
          Un bandeau sur l’Accueil te propose de sauvegarder quand la dernière sauvegarde est trop ancienne.
        </p>
      </div>

      {folderSupported && (
        <div className={settingsStyles.card} style={{ marginTop: 'var(--space-12)' }}>
          <div className={settingsStyles.row}>
            <span className={settingsStyles.rowLabel}>Dossier de sauvegarde</span>
            <span className={settingsStyles.rowValue}>{folder ? folder.name : 'Aucun'}</span>
          </div>
          <div className={settingsStyles.row}>
            <Button variant="secondary" onClick={handleChooseFolder}>
              {folder ? 'Changer de dossier' : 'Choisir un dossier de sauvegarde'}
            </Button>
            {folder && (
              <Button variant="ghost" onClick={handleClearFolder}>
                Retirer
              </Button>
            )}
          </div>
          <p className={settingsStyles.helperText}>
            Les prochaines sauvegardes y sont écrites directement. Le navigateur peut te redemander l’autorisation à
            chaque fois : c’est normal.
          </p>
        </div>
      )}

      <BackupExportSheet backup={backup} />
      <ImportBackupSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </section>
  )
}

