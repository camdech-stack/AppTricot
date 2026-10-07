// Step 9: importing a guide that was produced OUTSIDE the app (typically by an
// AI assistant in a separate conversation). Pure functions only — no I/O, no
// network, no Dexie. The app itself never contacts any AI service.
import type { GuideContent } from './guideModel'
import { computeGuideStats, migrateGuideContent, normalizeGuideContent, validateGuideContent, type GuideStats } from './guideTree'
import type { ProjectCraft } from './types'

// A real pattern is a few hundred KB of JSON at most; 5 MB is generous while
// still keeping a pasted wall of text from freezing the page.
export const MAX_GUIDE_IMPORT_BYTES = 5 * 1024 * 1024

const CURRENT_GUIDE_SCHEMA_VERSION = 1

// Optional top-level fields next to `pieces`, so a conversion prompt can hand
// back a suggested name/type/size. None of them is required, none is part of
// GuideContent (normalizeGuideContent drops them).
export interface GuideImportHints {
  name: string | null
  craft: ProjectCraft | null
  sizeLabel: string | null
}

interface AnalysisBase {
  // Automatic, harmless adjustments that were applied and must be shown.
  notes: string[]
  hints: GuideImportHints
}

export type GuideImportAnalysis =
  | { status: 'invalid'; errors: string[]; technical: string }
  | (AnalysisBase & { status: 'valid'; content: GuideContent; stats: GuideStats })
  | (AnalysisBase & {
      status: 'repairable'
      // The repaired tree, only to be used once the user accepts `corrections`.
      content: GuideContent
      stats: GuideStats
      // One line per problem that the repair fixes (the problem itself, so
      // the user sees what changes).
      corrections: string[]
      // True when the repair removes something that was present in the input
      // (unknown block type, too-deep nesting…) rather than just filling a gap.
      removesContent: boolean
      technical: string
    })

const EMPTY_HINTS: GuideImportHints = { name: null, craft: null, sizeLabel: null }

function invalid(errors: string[]): GuideImportAnalysis {
  return { status: 'invalid', errors, technical: buildTechnicalDetail(errors) }
}

function buildTechnicalDetail(errors: string[]): string {
  return [
    'Import de guide : détail technique',
    `Format attendu : schemaVersion ${CURRENT_GUIDE_SCHEMA_VERSION}, voir docs/Guidespatrons.md`,
    '',
    ...errors.map((error) => `- ${error}`),
  ].join('\n')
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} Mo`
}

// Assistants like to wrap JSON in a markdown fence ("```json … ```").
function stripCodeFence(text: string): { text: string; stripped: boolean } {
  const match = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```\s*$/.exec(text)
  return match ? { text: match[1]!, stripped: true } : { text, stripped: false }
}

function describeParseError(error: unknown, text: string): string {
  const message = error instanceof Error ? error.message : String(error)
  // V8 reports "at position N"; Safari/Firefox word it differently and may
  // give no position at all — then we just say the text is not valid JSON.
  const positionMatch = /position (\d+)/.exec(message)
  if (positionMatch) {
    const position = Number(positionMatch[1])
    const before = text.slice(0, position)
    const line = before.split('\n').length
    const column = position - before.lastIndexOf('\n')
    return `Ce texte n’est pas du JSON valide : erreur à la ligne ${line}, colonne ${column} (caractère ${position + 1}).`
  }
  return 'Ce texte n’est pas du JSON valide (une virgule, une accolade ou un guillemet est probablement mal placé).'
}

function readHints(raw: Record<string, unknown>): GuideImportHints {
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 200) : null
  const sizeLabel = typeof raw.sizeLabel === 'string' && raw.sizeLabel.trim() ? raw.sizeLabel.trim().slice(0, 100) : null
  let craft: ProjectCraft | null = null
  if (raw.craft === 'knitting' || raw.craft === 'tricot') craft = 'knitting'
  else if (raw.craft === 'crochet') craft = 'crochet'
  return { name, craft, sizeLabel }
}

// Errors whose repair deletes data that was there, as opposed to filling in a
// missing field (see normalizeGuideContent: unknown blocks are dropped, too
// deep nesting is truncated).
const CONTENT_REMOVING_ERROR = /type de bloc inconnu|bloc invalide|profondeur|rang invalide|section invalide|pièce invalide/

export function analyzeGuideImport(rawText: string): GuideImportAnalysis {
  if (byteLength(rawText) > MAX_GUIDE_IMPORT_BYTES) {
    return invalid([`Le texte est trop volumineux (plus de ${formatMegabytes(MAX_GUIDE_IMPORT_BYTES)}). Un guide de patron est bien plus petit : vérifie que tu as copié le bon contenu.`])
  }

  const notes: string[] = []
  let text = rawText.replace(/^﻿/, '').trim()
  if (!text) return invalid(['Le texte est vide : colle le JSON du guide ou choisis un fichier.'])

  const fence = stripCodeFence(text)
  if (fence.stripped) {
    text = fence.text.trim()
    notes.push('Les marques de bloc de code (```) autour du JSON ont été retirées.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return invalid([describeParseError(error, text)])
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return invalid(['Le JSON doit être un objet avec une liste "pieces" (voir « Comment ça marche ? »).'])
  }
  const raw = parsed as Record<string, unknown>
  const hints = readHints(raw)

  const version = raw.schemaVersion
  if (typeof version === 'number' && Number.isInteger(version)) {
    if (version > CURRENT_GUIDE_SCHEMA_VERSION) {
      return invalid([`Ce guide utilise une version du format (${version}) plus récente que celle de l’app (${CURRENT_GUIDE_SCHEMA_VERSION}). Mets l’app à jour avant de l’importer.`])
    }
    if (version < CURRENT_GUIDE_SCHEMA_VERSION) {
      // No format older than v1 was ever published; a lower number is a
      // pre-release draft, brought forward by normalizing then migrating.
      parsed = migrateGuideContent(normalizeGuideContent(raw))
      notes.push(`Ancienne version du format (${version}) mise à niveau vers la version ${CURRENT_GUIDE_SCHEMA_VERSION}.`)
    }
  }

  const errors = validateGuideContent(parsed)
  if (errors.length === 0) {
    const content = migrateGuideContent(parsed as GuideContent)
    if (content.pieces.length === 0) return invalid(['Le guide ne contient aucune pièce.'])
    return { status: 'valid', content, stats: computeGuideStats(content), notes, hints }
  }

  // Not valid as is. If it cannot even be a guide (no usable list of pieces),
  // there is nothing to repair; otherwise offer the repair — never apply it
  // without the user's explicit confirmation.
  if (!Array.isArray((parsed as Record<string, unknown>).pieces)) return invalid(errors)
  const repaired = migrateGuideContent(normalizeGuideContent(parsed))
  const remaining = validateGuideContent(repaired)
  if (remaining.length > 0) return invalid(errors)
  if (repaired.pieces.length === 0) return invalid([...errors, 'Le guide ne contient aucune pièce utilisable.'])

  return {
    status: 'repairable',
    content: repaired,
    stats: computeGuideStats(repaired),
    corrections: errors,
    removesContent: errors.some((error) => CONTENT_REMOVING_ERROR.test(error)),
    technical: buildTechnicalDetail(errors),
    notes,
    hints,
  }
}

// "pull-torsades.json" -> "pull-torsades"; used only as a last-resort name.
export function guideNameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim()
}

export { EMPTY_HINTS as NO_GUIDE_IMPORT_HINTS }
