import { updateSettings } from '../settingsRepository'
import { hideReminderForSession } from './reminder'

export type DeliveryResult =
  // The native share sheet completed.
  | 'shared'
  // A download was triggered (or the file was written to the chosen folder).
  | 'downloaded'
  // The user closed the share sheet.
  | 'cancelled'
  // The browser refused to open the share sheet without a fresh tap (the
  // gesture expired while the archive was being built): needs one more tap.
  | 'needs_gesture'

function prefersShareSheet(): boolean {
  // Share sheets make sense on touch devices; on a computer a plain
  // download lands the file where people expect it.
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
}

export function canShareFile(file: File): boolean {
  return prefersShareSheet() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

export function triggerDownload(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoked late: some browsers start reading the blob after the click.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// Hands the file to the user with at most one gesture on their side: the
// share sheet / download. Never pretends to save anything silently.
export async function deliverBackup(file: File): Promise<DeliveryResult> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'AbortError') return 'cancelled'
      if (name === 'NotAllowedError') return 'needs_gesture'
      // Anything else: fall through to a plain download.
    }
  }
  triggerDownload(file)
  return 'downloaded'
}

// Called once the file really left the app (shared, downloaded or written
// to the chosen folder).
export async function markBackupDone(at: Date = new Date()): Promise<void> {
  await updateSettings({ lastBackupAt: at.toISOString(), backupReminderSnoozedAt: null })
  hideReminderForSession()
}

export async function snoozeBackupReminder(at: Date = new Date()): Promise<void> {
  await updateSettings({ backupReminderSnoozedAt: at.toISOString() })
  hideReminderForSession()
}
