// Copies pdf.js's standard font data into public/ so Vite serves it and the
// service worker can precache it for offline rendering of PDFs whose fonts
// aren't embedded (see CLAUDE.md "pdf.js"). Not committed to git (see
// .gitignore) — this script is the single source of truth, run before dev
// and build via the predev/prebuild npm scripts.
//
// The much larger `cmaps` directory (mostly CJK encodings, ~1.7MB) is
// deliberately not copied: this app's patterns are French/English text, so
// it isn't worth the offline storage/precache weight.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(rootDir, 'node_modules/pdfjs-dist/standard_fonts')
const destination = join(rootDir, 'public/pdf/standard-fonts')

if (!existsSync(source)) {
  throw new Error(`pdfjs-dist standard_fonts not found at ${source} — is pdfjs-dist installed?`)
}

rmSync(destination, { recursive: true, force: true })
mkdirSync(destination, { recursive: true })
cpSync(source, destination, { recursive: true })

console.log(`Copied pdf.js standard fonts to ${destination}`)
