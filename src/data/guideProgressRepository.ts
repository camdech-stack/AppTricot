import { db } from './db'
import { createId } from './id'
import { nowIso } from './date'
import { applyCounterDeltaInTx } from './countersRepository'
import { recordActivity, startSession } from './sessionsRepository'
import {
  advance as advanceCursor,
  back as backCursor,
  computeStepsDone,
  createEmptyPieceProgress,
  getGuideProgress,
  getInitialCursor,
  getNextAvailablePieceId,
  getResumeSummary,
  goTo as goToCursor,
  PIECE_HISTORY_LIMIT,
  repairCursor,
  type Cursor,
  type CursorDescription,
  type GuideProgressState,
  type PieceProgress,
} from './guideProgress'
import type { GuideContent } from './guideModel'
import type { ProgressGuideInput } from './progress'
import type { GuideProgressRecord } from './types'

async function loadContent(guideId: string): Promise<GuideContent> {
  const record = await db.guideContents.get(guideId)
  if (!record) throw new Error(`Contenu de guide introuvable : ${guideId}`)
  return record.content
}

function emptyRecord(projectId: string, guideId: string, now: string): GuideProgressRecord {
  return {
    id: createId(),
    projectId,
    guideId,
    activePieceId: null,
    pieces: {},
    linkedCounterId: null,
    startedAt: now,
    lastAdvancedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

async function findRecord(projectId: string, guideId: string): Promise<GuideProgressRecord | undefined> {
  return db.guideProgress.where('[projectId+guideId]').equals([projectId, guideId]).first()
}

export async function getProgress(projectId: string, guideId: string): Promise<GuideProgressRecord | undefined> {
  return findRecord(projectId, guideId)
}

export async function getOrCreateProgress(projectId: string, guideId: string): Promise<GuideProgressRecord> {
  return db.transaction('rw', db.guideProgress, async (tx) => {
    const table = tx.table('guideProgress')
    const existing = (await table.where('[projectId+guideId]').equals([projectId, guideId]).first()) as GuideProgressRecord | undefined
    if (existing) return existing
    const record = emptyRecord(projectId, guideId, nowIso())
    await table.add(record)
    return record
  })
}

// Refuses to select a piece unless it's exactly the one
// getNextAvailablePieceId currently allows — the caller (the UI) must
// never let the user choose a piece out of order.
export async function setActivePiece(projectId: string, guideId: string, pieceId: string): Promise<GuideProgressRecord> {
  return db.transaction('rw', db.guideProgress, db.guideContents, async (tx) => {
    const content = await loadContent(guideId)
    const table = tx.table('guideProgress')
    const existing = (await table.where('[projectId+guideId]').equals([projectId, guideId]).first()) as GuideProgressRecord | undefined
    const state: GuideProgressState = existing ?? { activePieceId: null, pieces: {} }
    const allowed = getNextAvailablePieceId(content, state)
    if (allowed !== pieceId) {
      throw new Error('Cette pièce ne peut pas être choisie hors ordre : les pièces se tricotent dans l’ordre du guide.')
    }
    const now = nowIso()
    const record = existing ?? emptyRecord(projectId, guideId, now)
    const updated: GuideProgressRecord = { ...record, activePieceId: pieceId, updatedAt: now }
    await table.put(updated)
    return updated
  })
}

// The "démarrage du guide" for the chrono (see CLAUDE.md "Suivi du
// temps") — creates the progress record if needed, moves activePieceId to
// getNextAvailablePieceId (auto-skipping any piece with zero steps so the
// guide never gets stuck on one nothing can be done with), sets its
// initial cursor if it doesn't have one yet, and starts a session. Calling
// it again on an already-started piece just resumes it (no session churn
// beyond what startSession already dedupes).
export async function startGuide(projectId: string, guideId: string): Promise<GuideProgressRecord> {
  const record = await db.transaction('rw', db.guideProgress, db.guideContents, async (tx) => {
    const content = await loadContent(guideId)
    const table = tx.table('guideProgress')
    const existing = (await table.where('[projectId+guideId]').equals([projectId, guideId]).first()) as GuideProgressRecord | undefined
    const now = nowIso()
    let current = existing ?? emptyRecord(projectId, guideId, now)

    let nextPieceId = getNextAvailablePieceId(content, current)
    while (nextPieceId) {
      const piece = content.pieces.find((candidate) => candidate.id === nextPieceId)
      if (!piece) break
      const existingPieceProgress = current.pieces[nextPieceId]
      if (existingPieceProgress?.cursor) break // already started, has a real position
      const initial = getInitialCursor(piece)
      if (initial !== null) break
      // A piece with zero steps can never be "worked" — mark it done right
      // away so the guide doesn't get stuck waiting on it.
      current = { ...current, pieces: { ...current.pieces, [nextPieceId]: { ...createEmptyPieceProgress(), status: 'done' } }, updatedAt: now }
      nextPieceId = getNextAvailablePieceId(content, current)
    }

    if (nextPieceId) {
      const piece = content.pieces.find((candidate) => candidate.id === nextPieceId)!
      const existingPieceProgress = current.pieces[nextPieceId] ?? createEmptyPieceProgress()
      const cursor = existingPieceProgress.cursor ?? getInitialCursor(piece)
      current = {
        ...current,
        activePieceId: nextPieceId,
        pieces: { ...current.pieces, [nextPieceId]: { ...existingPieceProgress, status: 'in_progress', cursor } },
        updatedAt: now,
      }
    } else if (!current.completedAt) {
      current = { ...current, activePieceId: null, completedAt: now, updatedAt: now }
    }

    await table.put(current)
    return current
  })

  // Outside the guideProgress/guideContents transaction so it can freely
  // join its own (sessions/settings) — see sessionsRepository's reentrant-
  // transaction convention. Only starts a session if there's actually a
  // piece to work: a fully-finished guide starts nothing.
  if (record.activePieceId) {
    await startSession({ projectId }, 'guide')
  }
  return record
}

export type GuideAdvanceAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'reached' }
  | { type: 'notReached' }
  | { type: 'finishBlock' }
  // Targets `pieceId` explicitly (not necessarily the active piece) so the
  // guide plan sheet can jump into an already-"done" piece to relire/
  // corriger it — see CLAUDE.md "Plan du guide". Refused for any piece
  // that isn't the active one and isn't done yet (a "future" piece).
  | { type: 'goTo'; pieceId: string; targetNodeId: string; loopPassage?: number }
  | { type: 'finishPiece' }

// The single write path for every step taken while following a guide: one
// transaction that (1) reads the progress and the guide's content fresh,
// (2) repairs the cursor if the guide changed underneath it, (3) computes
// the next cursor/piece status/stepsDone, (4) records activity (chrono),
// (5) touches the project's lastActivityAt, and (6) mirrors a row's
// "next"/"back" onto the linked counter, if any — via the exact same
// transactional counter logic as a tap on the counter screen (step 1).
// Rapid actions can never race or drop a step, same guarantee as
// applyCounterDelta.
export async function advanceGuide(projectId: string, guideId: string, action: GuideAdvanceAction): Promise<GuideProgressRecord> {
  return db.transaction(
    'rw',
    [db.guideProgress, db.guideContents, db.counters, db.counterEvents, db.projects, db.sessions, db.settings],
    async (tx) => {
      const content = await loadContent(guideId)
      const table = tx.table('guideProgress')
      const existing = (await table.where('[projectId+guideId]').equals([projectId, guideId]).first()) as GuideProgressRecord | undefined
      const now = nowIso()
      const record = existing ?? emptyRecord(projectId, guideId, now)

      // "goTo" is the one action that can target a piece OTHER than the
      // active one — an already-"done" piece, to relire/corriger it. Every
      // other action always operates on the active piece.
      const pieceId = action.type === 'goTo' ? action.pieceId : record.activePieceId
      if (!pieceId) throw new Error('Aucune pièce active : démarre le guide avant de progresser.')
      const piece = content.pieces.find((candidate) => candidate.id === pieceId)
      if (!piece) throw new Error(`Pièce introuvable : ${pieceId}`)

      let pieceProgress = record.pieces[pieceId] ?? createEmptyPieceProgress()
      const isActivePiece = pieceId === record.activePieceId
      if (action.type === 'goTo' && !isActivePiece && pieceProgress.status !== 'done') {
        throw new Error('Cette pièce n’est pas encore accessible : termine d’abord les pièces qui la précèdent.')
      }

      if (pieceProgress.cursor) {
        const repaired = repairCursor(content, pieceProgress.cursor)
        if (repaired.adjusted) pieceProgress = { ...pieceProgress, cursor: repaired.cursor }
      }

      let nextCursor: Cursor | 'finished' | null
      let countsAsRowStep = false
      let counterDelta = 0

      switch (action.type) {
        case 'next':
        case 'finishPiece':
          countsAsRowStep = pieceProgress.cursor?.step === 'row'
          counterDelta = 1
          nextCursor = advanceCursor(piece, pieceProgress.cursor, {})
          break
        case 'back':
          countsAsRowStep = pieceProgress.cursor?.step === 'row'
          counterDelta = -1
          nextCursor = backCursor(piece, pieceProgress.cursor, pieceProgress.history)
          break
        case 'reached':
          nextCursor = advanceCursor(piece, pieceProgress.cursor, { reached: true })
          break
        case 'notReached':
          nextCursor = advanceCursor(piece, pieceProgress.cursor, { reached: false })
          break
        case 'finishBlock':
          nextCursor = advanceCursor(piece, pieceProgress.cursor, { finishBlock: true })
          break
        case 'goTo':
          nextCursor = goToCursor(piece, action.targetNodeId, pieceProgress.cursor, { loopPassage: action.loopPassage })
          break
      }

      let updatedPieceProgress: PieceProgress
      if (nextCursor === 'finished') {
        const stepsDone = computeStepsDone(piece, pieceProgress.cursor) + (pieceProgress.cursor ? 1 : 0)
        updatedPieceProgress = { ...pieceProgress, status: 'done', cursor: null, history: [], stepsDone }
      } else if (nextCursor === null) {
        // `back` at the very start, or a `goTo` to a node that no longer
        // exists: nothing to move to, the position is left untouched.
        updatedPieceProgress = pieceProgress
      } else if (action.type === 'goTo' && !isActivePiece) {
        // Reviewing an already-finished piece never reopens it — its
        // status and stepsDone (the real, final ones) stay exactly as they
        // were; only the cursor moves, so the follow screen can show
        // "you're looking at row X" without touching progress at all.
        updatedPieceProgress = {
          ...pieceProgress,
          cursor: nextCursor,
          history: pieceProgress.cursor ? [...pieceProgress.history, pieceProgress.cursor].slice(-PIECE_HISTORY_LIMIT) : pieceProgress.history,
        }
      } else {
        const history =
          action.type === 'back'
            ? pieceProgress.history.slice(0, -1)
            : pieceProgress.cursor
              ? [...pieceProgress.history, pieceProgress.cursor].slice(-PIECE_HISTORY_LIMIT)
              : pieceProgress.history
        updatedPieceProgress = {
          ...pieceProgress,
          status: 'in_progress',
          cursor: nextCursor,
          history,
          stepsDone: computeStepsDone(piece, nextCursor),
        }
      }

      let updatedRecord: GuideProgressRecord = {
        ...record,
        pieces: { ...record.pieces, [pieceId]: updatedPieceProgress },
        lastAdvancedAt: now,
        updatedAt: now,
      }

      // Finishing the ACTIVE piece never auto-selects the next one — only
      // an explicit "Passer à [pièce suivante]" (which re-calls startGuide)
      // does, per CLAUDE.md "Principe" (never a free choice, never
      // automatic). Reviewing an already-done piece via goTo never touches
      // activePieceId at all (isActivePiece is false there).
      if (isActivePiece && updatedPieceProgress.status === 'done') {
        updatedRecord = { ...updatedRecord, activePieceId: null }
      }

      const allPiecesDone = content.pieces.every((candidate) => (updatedRecord.pieces[candidate.id] ?? createEmptyPieceProgress()).status === 'done')
      if (allPiecesDone) {
        updatedRecord = { ...updatedRecord, completedAt: updatedRecord.completedAt ?? now }
      }

      await table.put(updatedRecord)

      if (isActivePiece && record.linkedCounterId && countsAsRowStep && counterDelta !== 0) {
        await applyCounterDeltaInTx(tx, record.linkedCounterId, counterDelta)
      }

      await tx.table('projects').update(projectId, { lastActivityAt: now })
      await recordActivity({ projectId }, now, tx, { origin: 'guide' })

      return updatedRecord
    },
  )
}

export type ResetScope = { type: 'guide' } | { type: 'piece'; pieceId: string }

// Resets progress for the whole guide, or for one piece — restarting a
// piece cascades forward to every piece AFTER it in array order (never to
// the ones before), so a piece can never stay "done" while an earlier one
// is "todo" again: pieces are always worked in the guide's own order (see
// CLAUDE.md "Principe"), and restarting piece N mid-guide would otherwise
// leave that invariant broken if pieces after N kept their own progress.
// Neither scope touches sessions or the linked counter's value — time
// spent and rows already counted stay exactly as they are.
export async function resetProgress(projectId: string, guideId: string, scope: ResetScope): Promise<GuideProgressRecord> {
  return db.transaction('rw', db.guideProgress, db.guideContents, async (tx) => {
    const content = await loadContent(guideId)
    const table = tx.table('guideProgress')
    const existing = (await table.where('[projectId+guideId]').equals([projectId, guideId]).first()) as GuideProgressRecord | undefined
    const now = nowIso()
    const record = existing ?? emptyRecord(projectId, guideId, now)

    if (scope.type === 'guide') {
      const updated: GuideProgressRecord = { ...record, activePieceId: null, pieces: {}, completedAt: null, updatedAt: now }
      await table.put(updated)
      return updated
    }

    const pieceIndex = content.pieces.findIndex((piece) => piece.id === scope.pieceId)
    if (pieceIndex === -1) throw new Error(`Pièce introuvable : ${scope.pieceId}`)

    const pieces = { ...record.pieces }
    for (let index = pieceIndex; index < content.pieces.length; index++) {
      delete pieces[content.pieces[index]!.id]
    }
    const updated: GuideProgressRecord = { ...record, activePieceId: null, pieces, completedAt: null, updatedAt: now }
    await table.put(updated)
    return updated
  })
}

export async function setLinkedCounter(projectId: string, guideId: string, counterId: string | null): Promise<GuideProgressRecord> {
  return db.transaction('rw', db.guideProgress, async (tx) => {
    const table = tx.table('guideProgress')
    const existing = (await table.where('[projectId+guideId]').equals([projectId, guideId]).first()) as GuideProgressRecord | undefined
    const now = nowIso()
    const record = existing ?? emptyRecord(projectId, guideId, now)
    const updated: GuideProgressRecord = { ...record, linkedCounterId: counterId, updatedAt: now }
    await table.put(updated)
    return updated
  })
}

// Every ProgressGuideInput for a project's linked guides, for
// computeProjectProgress (progress.ts) — one entry per linked guide, even
// one that hasn't been started yet (knownSteps/doneSteps both 0, harmless
// to sum in).
export async function getProjectGuideProgressInputs(projectId: string): Promise<ProgressGuideInput[]> {
  const links = await db.projectGuides.where('projectId').equals(projectId).toArray()
  if (links.length === 0) return []
  const records = await db.guideProgress.where('projectId').equals(projectId).toArray()
  const byGuideId = new Map(records.map((record) => [record.guideId, record]))

  const inputs: ProgressGuideInput[] = []
  for (const link of links) {
    const contentRecord = await db.guideContents.get(link.guideId)
    if (!contentRecord) continue
    const state: GuideProgressState = byGuideId.get(link.guideId) ?? { activePieceId: null, pieces: {} }
    const summary = getGuideProgress(contentRecord.content, state)
    inputs.push({ knownSteps: summary.total, doneSteps: summary.done })
  }
  return inputs
}

export interface ProjectGuideResumeSummary {
  guideId: string
  pieceId: string | null
  description: CursorDescription | null
  percent: number
  lastAdvancedAt: string
}

// Step 6's per-project "reprise rapide": picks whichever linked guide was
// advanced most recently, preferring one that isn't fully finished yet.
// Wraps the pure, single-guide getResumeSummary (guideProgress.ts).
// Returns null when the project has no guide with any recorded progress.
export async function getProjectResumeSummary(projectId: string): Promise<ProjectGuideResumeSummary | null> {
  const links = await db.projectGuides.where('projectId').equals(projectId).toArray()
  if (links.length === 0) return null

  const records = await db.guideProgress.where('projectId').equals(projectId).toArray()
  const candidates = records.filter((record) => links.some((link) => link.guideId === record.guideId))
  if (candidates.length === 0) return null

  const notCompleted = candidates.filter((record) => !record.completedAt)
  const pool = notCompleted.length > 0 ? notCompleted : candidates
  const latest = pool.reduce((best, record) => (record.lastAdvancedAt > best.lastAdvancedAt ? record : best))

  const contentRecord = await db.guideContents.get(latest.guideId)
  if (!contentRecord) return null

  const summary = getResumeSummary(contentRecord.content, latest)
  return {
    guideId: latest.guideId,
    pieceId: summary.activePieceId,
    description: summary.description,
    percent: summary.percent,
    lastAdvancedAt: latest.lastAdvancedAt,
  }
}
