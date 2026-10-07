// Optional "persistent backup folder" (File System Access API). The only
// non-JSON-serialisable object in the backup module: a FileSystemDirectoryHandle,
// kept in its own tiny IndexedDB database so it stays out of the Dexie schema
// and of every export. Everything here degrades to "unsupported" silently —
// the app never depends on it.

type PermissionState = 'granted' | 'denied' | 'prompt'

interface WritableHandle {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

export interface BackupDirectoryHandle {
  readonly name: string
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{ createWritable(): Promise<WritableHandle> }>
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
}

type DirectoryPicker = (options?: { mode?: 'readwrite' }) => Promise<BackupDirectoryHandle>

const HANDLE_DB = 'tricot-backup-folder'
const HANDLE_STORE = 'handles'
const HANDLE_KEY = 'directory'

// Safari on iOS does not ship showDirectoryPicker; the option is then
// simply not rendered.
export function isBackupFolderSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(HANDLE_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openHandleDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(database.transaction(HANDLE_STORE, mode).objectStore(HANDLE_STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
}

export async function getBackupFolder(): Promise<BackupDirectoryHandle | null> {
  if (!isBackupFolderSupported()) return null
  try {
    return ((await withStore('readonly', (store) => store.get(HANDLE_KEY))) as BackupDirectoryHandle | undefined) ?? null
  } catch {
    return null
  }
}

export async function chooseBackupFolder(): Promise<BackupDirectoryHandle | null> {
  if (!isBackupFolderSupported()) return null
  try {
    const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker
    const handle = await picker.call(window, { mode: 'readwrite' })
    await withStore('readwrite', (store) => store.put(handle, HANDLE_KEY))
    return handle
  } catch {
    // Cancelled by the user, or refused by the browser.
    return null
  }
}

export async function clearBackupFolder(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(HANDLE_KEY))
  } catch {
    // Nothing to clear.
  }
}

// Must be called from a tap handler, BEFORE any long await: browsers only
// show the permission prompt on a fresh user gesture.
export async function ensureFolderPermission(handle: BackupDirectoryHandle): Promise<boolean> {
  try {
    if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true
    return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
  } catch {
    return false
  }
}

export async function writeBackupToFolder(handle: BackupDirectoryHandle, file: File): Promise<void> {
  const fileHandle = await handle.getFileHandle(file.name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(file)
  await writable.close()
}
