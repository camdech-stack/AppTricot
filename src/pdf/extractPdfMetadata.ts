import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getPdfjs, STANDARD_FONT_DATA_URL } from './pdfjs'

export interface PdfMetadata {
  pageCount: number
  title: string | null
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

// Reads page count + title from a PDF's metadata and renders its first page
// as the auto cover. Used both at import time and when replacing a file's
// version — see CLAUDE.md "Remplacer une version".
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
    const metadata = await doc.getMetadata().catch(() => null)
    const rawTitle = (metadata?.info as { Title?: string } | undefined)?.Title
    const title = rawTitle?.trim() || null
    const coverBlob = await renderCover(doc)

    return { pageCount, title, coverBlob }
  } finally {
    await loadingTask.destroy()
  }
}

async function renderCover(doc: PDFDocumentProxy): Promise<Blob> {
  const page = await doc.getPage(1)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(1, COVER_MAX_SIDE / Math.max(baseViewport.width, baseViewport.height))
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Contexte canvas 2D indisponible')

  await page.render({ canvas, canvasContext: context, viewport }).promise

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Échec de la génération de la couverture'))),
      'image/jpeg',
      COVER_QUALITY,
    )
  })
}
