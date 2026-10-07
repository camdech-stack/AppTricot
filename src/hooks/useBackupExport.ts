import { useCallback, useRef, useState } from 'react'
import {
  buildBackup,
  deliverBackup,
  ensureFolderPermission,
  getBackupFolder,
  markBackupDone,
  writeBackupToFolder,
  type DeliveryResult,
} from '../data'

export type BackupDestination = 'shared' | 'downloaded' | 'folder'

export type BackupExportState =
  | { phase: 'idle' }
  | { phase: 'working'; percent: number }
  // Built but not handed over yet: the share sheet was closed, or the
  // browser wants one more tap (the first one expired while building).
  | { phase: 'ready'; file: File; itemCount: number; needsTap: boolean; notice: string | null }
  | { phase: 'done'; sizeBytes: number; itemCount: number; fileCount: number; destination: BackupDestination; fileName: string; folderName?: string }
  | { phase: 'error'; message: string }

export interface BackupExport {
  state: BackupExportState
  start: () => void
  deliverAgain: () => void
  reset: () => void
}

// One user tap -> archive built in memory -> share sheet / download / chosen
// folder. Nothing here writes anywhere without that tap.
export function useBackupExport(onDone?: () => void): BackupExport {
  const [state, setState] = useState<BackupExportState>({ phase: 'idle' })
  const busy = useRef(false)
  const pending = useRef<{ itemCount: number; fileCount: number } | null>(null)
  const ready = useRef<{ file: File; itemCount: number } | null>(null)

  const finishDelivery = useCallback(
    async (file: File, result: DeliveryResult, itemCount: number, fileCount: number, notice: string | null) => {
      if (result === 'shared' || result === 'downloaded') {
        await markBackupDone()
        setState({ phase: 'done', sizeBytes: file.size, itemCount, fileCount, destination: result, fileName: file.name })
        onDone?.()
        return
      }
      ready.current = { file, itemCount }
      setState({
        phase: 'ready',
        file,
        itemCount,
        needsTap: result === 'needs_gesture',
        notice: result === 'cancelled' ? "Le partage a été fermé : la sauvegarde n'est pas encore enregistrée." : notice,
      })
    },
    [onDone],
  )

  const start = useCallback(() => {
    if (busy.current) return
    busy.current = true
    setState({ phase: 'working', percent: 0 })

    void (async () => {
      try {
        // Permission prompts only appear on a fresh tap, so the folder
        // permission is asked before the (long) build.
        const folder = await getBackupFolder()
        const folderAllowed = folder ? await ensureFolderPermission(folder) : false

        const built = await buildBackup(({ percent }) => setState({ phase: 'working', percent }))
        const file = new File([built.blob], built.fileName, { type: 'application/zip' })
        pending.current = { itemCount: built.itemCount, fileCount: built.fileCount }

        if (folder && folderAllowed) {
          try {
            await writeBackupToFolder(folder, file)
            await markBackupDone()
            setState({
              phase: 'done',
              sizeBytes: file.size,
              itemCount: built.itemCount,
              fileCount: built.fileCount,
              destination: 'folder',
              fileName: file.name,
              folderName: folder.name,
            })
            onDone?.()
            return
          } catch {
            // Fall through to the normal share / download flow below.
          }
        }

        const notice = folder
          ? "Le dossier de sauvegarde n'est pas accessible (permission refusée ou dossier indisponible) : la sauvegarde est proposée au partage à la place."
          : null
        await finishDelivery(file, await deliverBackup(file), built.itemCount, built.fileCount, notice)
      } catch (error) {
        const quota = error instanceof Error && error.name === 'QuotaExceededError'
        setState({
          phase: 'error',
          message: quota
            ? "Pas assez de mémoire ou d'espace pour préparer la sauvegarde. Libère de la place et réessaie."
            : `La sauvegarde a échoué : ${error instanceof Error ? error.message : 'erreur inconnue'}.`,
        })
      } finally {
        busy.current = false
      }
    })()
  }, [finishDelivery, onDone])

  // Runs straight from the tap handler (no await before the share call),
  // which is what lets iOS open the share sheet.
  const deliverAgain = useCallback(() => {
    const current = ready.current
    if (!current) return
    void deliverBackup(current.file).then((result) =>
      finishDelivery(current.file, result, current.itemCount, pending.current?.fileCount ?? 0, null),
    )
  }, [finishDelivery])

  const reset = useCallback(() => setState({ phase: 'idle' }), [])

  return { state, start, deliverAgain, reset }
}
