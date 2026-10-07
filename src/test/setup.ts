// Polyfills IndexedDB for the data-layer tests: Dexie needs a real-ish
// IndexedDB implementation, which Node doesn't provide natively.
import 'fake-indexeddb/auto'

// Node has no FileReader, which JSZip uses to read Blob inputs. A minimal
// shim (readAsArrayBuffer only) keeps the backup tests close to the browser.
if (typeof globalThis.FileReader === 'undefined') {
  class FileReaderShim {
    result: ArrayBuffer | null = null
    error: unknown = null
    onload: ((event: unknown) => void) | null = null
    onerror: ((event: unknown) => void) | null = null
    readAsArrayBuffer(blob: Blob) {
      blob.arrayBuffer().then(
        (buffer) => {
          this.result = buffer
          this.onload?.({ target: this })
        },
        (error) => {
          this.error = error
          this.onerror?.({ target: this })
        },
      )
    }
  }
  ;(globalThis as unknown as { FileReader: unknown }).FileReader = FileReaderShim
}
