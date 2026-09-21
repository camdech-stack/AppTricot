import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { getPdfjs, STANDARD_FONT_DATA_URL } from './pdfjs'
import { cropToCoverImage } from './extractCoverImage'
import {
  findMaterialLines,
  groupTextIntoLines,
  guessCreatorFromLines,
  guessTitleFromLines,
  type PdfTextFragment,
  type TextLine,
} from './patternTextHeuristics'

export interface PdfMetadata {
  pageCount: number
  title: string | null
  creator: string | null
  // Lines that look like a needle/hook size ("aiguilles circulaires 4 mm,
  // 80 cm", "US 6 (4mm) circular needles") — collected as-is, not parsed
  // into structured data, so the user always sees exactly what the PDF
  // says (see CLAUDE.md "Extraction heuristique").
  materialsHint: string[]
  coverBlob: Blob
}

export type PdfReadErrorReason = 'password' | 'corrupt'

export class PdfReadError extends Error {
  readonly reason: PdfReadErrorReason

  constructor(reason: PdfReadErrorReason, message: string) {
    super(message)
    this.reason = reason
  }
}

// First-page render, side capped at 600px, JPEG 0.8 — same budget as
// compressCoverImage (see CLAUDE.md "Lecture avec pdf.js").
const COVER_MAX_SIDE = 600
const COVER_QUALITY = 0.8

// How many pages (from the start) to scan for title/creator/materials —
// patterns put all three early (a graphic cover is often followed by a
// text info page), and scanning text content (no rendering) is cheap, but
// an unbounded scan would be wasteful on a very long PDF.
const TEXT_SCAN_PAGE_LIMIT = 5

interface RawTextLike {
  str?: unknown
  height?: unknown
  hasEOL?: unknown
  transform?: unknown
}

// pdf.js's own TextItem type isn't re-exported from its public entry point
// (see patternTextHeuristics.ts) — this reads the fields we need off the
// untyped `getTextContent()` result and skips anything that isn't a real
// text fragment (TextMarkedContent, or a shape that doesn't match).
function toTextFragment(item: unknown): PdfTextFragment | null {
  const raw = item as RawTextLike
  if (typeof raw.str !== 'string' || typeof raw.height !== 'number') return null
  if (!Array.isArray(raw.transform) || typeof raw.transform[5] !== 'number') return null
  return { str: raw.str, height: raw.height, hasEOL: raw.hasEOL === true, y: raw.transform[5] }
}

async function getPageLines(page: PDFPageProxy): Promise<TextLine[]> {
  const content = await page.getTextContent().catch(() => null)
  if (!content) return []
  const fragments = content.items.map(toTextFragment).filter((item): item is PdfTextFragment => item !== null)
  return groupTextIntoLines(fragments)
}

// Reads page count, title, designer/creator, a materials hint and renders
// the auto cover. Used both at import time and when replacing a file's
// version — see CLAUDE.md "Remplacer une version". Title/creator/materials
// are heuristics (typography + a bilingual FR/EN phrase list), not an AI
// read of the pattern — see CLAUDE.md "Extraction heuristique" for why and
// its limits.
export async function extractPdfMetadata(data: ArrayBuffer): Promise<PdfMetadata> {
  const pdfjs = await getPdfjs()

  // pdf.js transfers (detaches) an ArrayBuffer passed as `data` to its
  // worker thread — callers of this function (import, replace-file) reuse
  // their own buffer afterward to hash it and store it as the pattern's
  // file, so pdf.js must only ever get a throwaway copy, never the
  // original.
  const loadingTask = pdfjs.getDocument({ data: data.slice(0), standardFontDataUrl: STANDARD_FONT_DATA_URL })

  let doc: PDFDocumentProxy
  try {
    doc = await loadingTask.promise
  } catch (error) {
    if (error instanceof pdfjs.PasswordException) {
      throw new PdfReadError('password', 'Ce PDF est protégé par un mot de passe (non pris en charge pour l’instant).')
    }
    throw new PdfReadError('corrupt', 'Ce fichier est invalide ou corrompu.')
  }

  try {
    const pageCount = doc.numPages
    const firstPage = await doc.getPage(1)

    // Scanned once, shared by the title/creator lookahead and the
    // materials collection below — a cover page is often a full graphic
    // with no real title text, so the title/creator search keeps checking
    // subsequent pages until it finds something plausible.
    const scannedPages: TextLine[][] = [await getPageLines(firstPage)]
    const lastPage = Math.min(pageCount, TEXT_SCAN_PAGE_LIMIT)
    for (let pageNumber = 2; pageNumber <= lastPage; pageNumber += 1) {
      scannedPages.push(await getPageLines(await doc.getPage(pageNumber)))
    }

    const metadata = await doc.getMetadata().catch(() => null)
    const info = metadata?.info as { Title?: string; Author?: string } | undefined

    let title: string | null = null
    let creator: string | null = null
    for (const lines of scannedPages) {
      title ??= guessTitleFromLines(lines)
      creator ??= guessCreatorFromLines(lines)
      if (title && creator) break
    }
    title ??= info?.Title?.trim() || null
    creator ??= info?.Author?.trim() || null

    const materialsHint = findMaterialLines(scannedPages.flat())
    const coverBlob = await renderCover(firstPage)

    return { pageCount, title, creator, materialsHint, coverBlob }
  } finally {
    await loadingTask.destroy()
  }
}

async function renderCover(page: PDFPageProxy): Promise<Blob> {
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(1, COVER_MAX_SIDE / Math.max(baseViewport.width, baseViewport.height))
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Contexte canvas 2D indisponible')

  await page.render({ canvas, canvasContext: context, viewport }).promise

  // Prefer the largest embedded photo over the full page when one is
  // clearly the cover — falls back to the full-page render whenever no
  // image is found or the detected region looks implausible.
  const cropped = await cropToCoverImage(page, viewport.transform, canvas)
  if (cropped) return cropped

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Échec de la génération de la couverture'))),
      'image/jpeg',
      COVER_QUALITY,
    )
  })
}
