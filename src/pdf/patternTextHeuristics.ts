// Structural subset of pdf.js's TextItem — defined locally since pdfjs-dist
// doesn't re-export TextItem from its public entry point (a deep import
// into its internal build output wouldn't survive an upgrade). `y` is the
// fragment's baseline (its transform's translate-Y component, in PDF user
// space) — see groupTextIntoLines for why it's needed alongside `hasEOL`.
export interface PdfTextFragment {
  str: string
  height: number
  hasEOL: boolean
  y: number
}

export interface TextLine {
  text: string
  // Largest font height among the line's fragments (device/user space) —
  // the strongest available signal for "this line is a heading", since
  // there's no markup to lean on in extracted PDF text.
  maxHeight: number
}

// How far (as a fraction of the current line's font height) a fragment's
// baseline can drift and still count as "the same line".
const LINE_Y_TOLERANCE_RATIO = 0.4

// Groups pdf.js's flat per-fragment text items into lines. Grouped
// primarily by vertical position rather than trusting each fragment's own
// `hasEOL` flag: that flag comes from pdf.js's own line-break heuristic,
// which is unreliable on PDFs where every text run is placed independently
// (common with cover pages designed in Canva/InDesign/Affinity rather than
// flowing text) — it can merge an entire page into one giant "line" our
// length filters then reject, or fragment a real line into many. `hasEOL`
// is still honored as an extra split point, since it's harmless when
// right and occasionally catches a break geometry alone would miss.
export function groupTextIntoLines(items: PdfTextFragment[]): TextLine[] {
  const lines: TextLine[] = []
  let parts: string[] = []
  let maxHeight = 0
  let lineY: number | null = null

  function flush() {
    const text = parts.join('').trim()
    if (text) lines.push({ text, maxHeight })
    parts = []
    maxHeight = 0
    lineY = null
  }

  for (const item of items) {
    const tolerance = Math.max(item.height, maxHeight, 1) * LINE_Y_TOLERANCE_RATIO
    if (lineY !== null && Math.abs(item.y - lineY) > tolerance) {
      flush()
    }
    parts.push(item.str)
    if (item.height > maxHeight) maxHeight = item.height
    lineY = item.y
    if (item.hasEOL) flush()
  }
  flush()

  return lines
}

const MIN_TITLE_LENGTH = 3
const MAX_TITLE_LENGTH = 80

// The pattern's real title is rarely PDF metadata's "Title" field (often
// just the saved file name) — the most reliable signal available without
// AI is typography: the title is normally the single largest line of text
// on the cover page. Font-size-based, so it works the same in French and
// English without any keyword list.
export function guessTitleFromLines(lines: TextLine[]): string | null {
  const candidates = lines.filter((line) => line.text.length >= MIN_TITLE_LENGTH && line.text.length <= MAX_TITLE_LENGTH)
  if (candidates.length === 0) return null
  return candidates.reduce((best, line) => (line.maxHeight > best.maxHeight ? line : best)).text
}

const MIN_CREATOR_LENGTH = 2
const MAX_CREATOR_LENGTH = 60

// Bylines are near-universally their own short line starting with one of a
// handful of fixed phrases, in French or English — unlike the title, font
// size doesn't help here (a byline is usually small text), so this leans
// on that fixed vocabulary instead. Every pattern is anchored at the start
// of the line to avoid matching the phrase mid-sentence in unrelated text.
const CREATOR_LINE_PATTERNS: RegExp[] = [
  /^(?:designed|created)\s+by[:\s]+(.+)$/i,
  /^pattern\s+by[:\s]+(.+)$/i,
  /^designer[:\s]+(.+)$/i,
  /^(?:conçu|créé|créée|dessiné|dessinée)\s+par[:\s]+(.+)$/i,
  /^(?:un\s+)?(?:modèle|patron)\s+(?:de|par)[:\s]+(.+)$/i,
  /^créatrice[:\s]+(.+)$/i,
  /^créateur[:\s]+(.+)$/i,
  /^by[:\s]+(.+)$/i,
  /^par[:\s]+(.+)$/i,
]

export function guessCreatorFromLines(lines: TextLine[]): string | null {
  for (const line of lines) {
    for (const pattern of CREATOR_LINE_PATTERNS) {
      const match = pattern.exec(line.text.trim())
      const captured = match?.[1]?.trim().replace(/[.,;:]+$/, '')
      if (captured && captured.length >= MIN_CREATOR_LENGTH && captured.length <= MAX_CREATOR_LENGTH) {
        return captured
      }
    }
  }
  return null
}

const MAX_MATERIAL_LINES = 10

// A line only counts as describing needles/hooks when it names the tool
// AND gives a measurement in the same line — either alone is too common in
// ordinary instructions ("aiguille auxiliaire", "4 mailles") to be a
// reliable signal. Both the tool and unit vocabularies cover French and
// English so the same regexes work for either language pattern.
const TOOL_KEYWORD_PATTERN = /aiguille[s]?|crochet|needle[s]?|\bhook\b|\bdpn\b|double[\s-]?point/i
const MEASUREMENT_PATTERN = /\d+(?:[.,]\d+)?\s*(?:mm|cm|in\b|"|po\b|pouces?)/i

export function isMaterialLine(text: string): boolean {
  return TOOL_KEYWORD_PATTERN.test(text) && MEASUREMENT_PATTERN.test(text)
}

export function findMaterialLines(lines: TextLine[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const line of lines) {
    if (!isMaterialLine(line.text)) continue
    const key = line.text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(line.text)
    if (result.length >= MAX_MATERIAL_LINES) break
  }
  return result
}
