// Lazily loads pdf.js and its worker. Never imported statically from
// anywhere reachable at startup (see CLAUDE.md "pdf.js" — the pattern
// import flow and the PDF viewer are the only callers, both already behind
// a dynamic import), so pdf.js's ~450KB library plus its ~1.3MB worker
// never touch the main bundle.
//
// pdfjs-dist 6.x ships a single modern ESM build (the old "legacy" build
// aimed at pre-2021 browsers was dropped) — that's the only option and it
// suits this app fine, since it only ever runs on current iOS/iPadOS Safari
// installed to the home screen.
import type * as PdfjsModule from 'pdfjs-dist'

let pdfjsPromise: Promise<typeof PdfjsModule> | undefined

export function getPdfjs(): Promise<typeof PdfjsModule> {
  pdfjsPromise ??= (async () => {
    const [pdfjsLib, workerUrlModule] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default
    return pdfjsLib
  })()
  return pdfjsPromise
}

// Served from public/pdf/standard-fonts (see scripts/copy-pdfjs-assets.mjs)
// so non-embedded standard fonts (common in text/OCR PDFs) still render
// correctly offline. The much larger CJK cmaps are deliberately not
// bundled — see the copy script's own comment.
export const STANDARD_FONT_DATA_URL = `${import.meta.env.BASE_URL}pdf/standard-fonts/`
