// Wraps the Storage Manager API so the rest of the app never touches
// `navigator.storage` directly. Browsers may silently lack this API
// (older Safari, some in-app browsers), hence the feature checks.
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  return navigator.storage.persist()
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false
  return navigator.storage.persisted()
}
