export type PdfValidationError = 'empty' | 'invalid'

const PDF_SIGNATURE = '%PDF'

// Checks the first bytes for the "%PDF" signature and rejects an empty file
// outright — a cheap sanity check before handing the file to pdf.js, which
// does the real structural validation (see CLAUDE.md "Validation"). Pure:
// takes already-read bytes, no File/Blob I/O.
export function validatePdfSignature(bytes: ArrayBuffer): PdfValidationError | null {
  if (bytes.byteLength === 0) return 'empty'
  if (bytes.byteLength < PDF_SIGNATURE.length) return 'invalid'
  const header = new Uint8Array(bytes.slice(0, PDF_SIGNATURE.length))
  const signature = String.fromCharCode(...header)
  return signature === PDF_SIGNATURE ? null : 'invalid'
}

const PDF_VALIDATION_MESSAGES: Record<PdfValidationError, string> = {
  empty: 'Ce fichier est vide.',
  invalid: "Ce fichier n'est pas un PDF valide ou est corrompu.",
}

export function pdfValidationMessage(error: PdfValidationError): string {
  return PDF_VALIDATION_MESSAGES[error]
}

// Default pattern name from a file name: strips the .pdf extension only,
// keeps everything else as-is — see CLAUDE.md "Lecture avec pdf.js".
export function defaultPatternName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.pdf$/i, '').trim()
  return withoutExtension || fileName
}

// Warn above 100MB, no artificial limit otherwise — see CLAUDE.md "Import".
export const PATTERN_SIZE_WARNING_BYTES = 100 * 1024 * 1024
