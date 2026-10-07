import styles from './Backup.module.css'
import { Button } from '../ui'
import { BackupExportSheet } from './BackupExportSheet'
import { useBackupExport } from '../../hooks/useBackupExport'
import { useBackupReminder } from '../../hooks/useBackupReminder'

function sinceText(days: number | null): string {
  if (days === null) return "Tu n'as pas encore de sauvegarde."
  if (days === 0) return "Dernière sauvegarde aujourd'hui."
  return `Dernière sauvegarde il y a ${days} jour${days > 1 ? 's' : ''}.`
}

// Non-blocking: "Plus tard" waits a full interval, the cross only hides it
// for this session. The export itself is a single tap on "Sauvegarder".
export function BackupReminderBanner() {
  const reminder = useBackupReminder()
  const backup = useBackupExport()
  const exporting = backup.state.phase !== 'idle'

  return (
    <>
      {reminder.visible && !exporting && (
        <section className={styles.banner} aria-label="Rappel de sauvegarde">
          <p className={styles.bannerText}>
            {sinceText(reminder.daysSinceLastBackup)} Sauvegarder maintenant ?
          </p>
          <div className={styles.bannerActions}>
            <Button size="sm" onClick={backup.start}>
              Sauvegarder maintenant
            </Button>
            <Button size="sm" variant="secondary" onClick={reminder.snooze}>
              Plus tard
            </Button>
            <Button size="sm" variant="ghost" onClick={reminder.dismiss}>
              Fermer
            </Button>
          </div>
        </section>
      )}
      <BackupExportSheet backup={backup} />
    </>
  )
}
