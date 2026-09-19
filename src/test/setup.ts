// Polyfills IndexedDB for the data-layer tests: Dexie needs a real-ish
// IndexedDB implementation, which Node doesn't provide natively.
import 'fake-indexeddb/auto'
