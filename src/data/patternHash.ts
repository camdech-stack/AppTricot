// SHA-256 hex digest of a file's bytes, used to detect a duplicate import
// (see CLAUDE.md "Doublon"). Web Crypto is available in every browser this
// app targets and in Node's test environment (fake-indexeddb doesn't touch
// crypto, so no polyfill is needed there).
export async function hashBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
