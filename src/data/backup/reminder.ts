import type { AppSettingsRecord } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export interface BackupReminderInput {
  settings: Pick<
    AppSettingsRecord,
    'backupReminderEnabled' | 'backupReminderIntervalDays' | 'lastBackupAt' | 'backupReminderSnoozedAt'
  >
  // At least one project or yarn exists.
  hasData: boolean
  now: Date
}

export interface BackupReminderState {
  due: boolean
  // Whole days since the last backup, null if there never was one.
  daysSinceLastBackup: number | null
}

export function daysBetween(fromIso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(fromIso)) / DAY_MS))
}

// A reminder is due when reminders are on, there is something to lose, and a
// full interval elapsed since the later of the last backup and the last
// "Plus tard". Never backed up (and never snoozed) counts as due.
export function getBackupReminderState({ settings, hasData, now }: BackupReminderInput): BackupReminderState {
  const daysSinceLastBackup = settings.lastBackupAt ? daysBetween(settings.lastBackupAt, now) : null
  const interval = settings.backupReminderIntervalDays
  if (!settings.backupReminderEnabled || interval === null || !hasData) {
    return { due: false, daysSinceLastBackup }
  }
  const reference = [settings.lastBackupAt, settings.backupReminderSnoozedAt]
    .filter((value): value is string => value !== null)
    .map((value) => Date.parse(value))
  if (reference.length === 0) return { due: true, daysSinceLastBackup }
  const elapsed = now.getTime() - Math.max(...reference)
  return { due: elapsed >= interval * DAY_MS, daysSinceLastBackup }
}

// The banner is decided once per app session (at the first Home render) and
// then stays until it is dismissed or a backup completes — navigating around
// never re-asks, and closing it never asks again until the next launch.
type SessionDecision = 'undecided' | 'show' | 'hidden'
let sessionDecision: SessionDecision = 'undecided'

export function decideReminderForSession(due: boolean): boolean {
  if (sessionDecision === 'undecided') sessionDecision = due ? 'show' : 'hidden'
  return sessionDecision === 'show'
}

export function hideReminderForSession(): void {
  sessionDecision = 'hidden'
}

export function resetReminderSessionForTests(): void {
  sessionDecision = 'undecided'
}
