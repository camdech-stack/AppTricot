import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  decideReminderForSession,
  getBackupReminderState,
  hasBackupWorthyData,
  hideReminderForSession,
  snoozeBackupReminder,
} from '../data'
import { useSettings } from './useSettings'

export interface BackupReminder {
  visible: boolean
  daysSinceLastBackup: number | null
  snooze: () => void
  dismiss: () => void
}

// Decided once per app session (see decideReminderForSession), so the
// banner never reappears after being closed and never flickers in later.
export function useBackupReminder(): BackupReminder {
  const settings = useSettings()
  const hasData = useLiveQuery(() => hasBackupWorthyData(), [])
  const [, forceRender] = useState(0)

  const ready = settings !== undefined && hasData !== undefined
  const state = ready
    ? getBackupReminderState({ settings, hasData, now: new Date() })
    : { due: false, daysSinceLastBackup: null }
  const visible = ready && decideReminderForSession(state.due)

  return {
    visible,
    daysSinceLastBackup: state.daysSinceLastBackup,
    snooze: () => {
      void snoozeBackupReminder()
      forceRender((tick) => tick + 1)
    },
    dismiss: () => {
      hideReminderForSession()
      forceRender((tick) => tick + 1)
    },
  }
}
