import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createProject, deleteProject } from './projectsRepository'
import { addCounter } from './countersRepository'
import { createGuide, deleteGuide, linkGuideToProject, saveGuideContent, unlinkGuideFromProject, getProjectGuides } from './guidesRepository'
import { updateSettings } from './settingsRepository'
import { resetForegroundState } from './sessionTrackingState'
import { addBlock, addPiece, addRow, addSection } from './guideTree'
import { emptyGuideContent, type GuideContent } from './guideModel'
import { computeProjectProgress, type ProgressGuideInput } from './progress'
import {
  advanceGuide,
  getOrCreateProgress,
  getProgress,
  getProjectGuideProgressInputs,
  getProjectResumeSummary,
  repairActiveCursor,
  resetProgress,
  setActivePiece,
  setLinkedCounter,
  startGuide,
} from './guideProgressRepository'
import { getGuideProgress } from './guideProgress'

beforeEach(async () => {
  await db.delete()
  await db.open()
  resetForegroundState()
})

async function createTestProject() {
  return createProject({ name: 'Écharpe', craft: 'knitting', description: '', colorKey: 'prune' })
}

// A guide with 2 pieces: "Dos" (a rows block, 3 rows) and "Devant" (a rows
// block, 2 rows). Invented content, per CLAUDE.md "Confidentialité".
async function createTwoPieceGuide() {
  let content: GuideContent = emptyGuideContent()
  const p1 = addPiece(content, { name: 'Dos' })
  content = p1.content
  const s1 = addSection(content, p1.id, { name: 'Corps', method: 'flat' })
  content = s1.content
  const b1 = addBlock(content, s1.id, 'rows')
  content = b1.content
  for (let i = 1; i <= 3; i++) {
    const r = addRow(content, b1.id, { number: i, instructions: `rang ${i}` })
    content = r.content
  }

  const p2 = addPiece(content, { name: 'Devant' })
  content = p2.content
  const s2 = addSection(content, p2.id, { name: 'Corps', method: 'flat' })
  content = s2.content
  const b2 = addBlock(content, s2.id, 'rows')
  content = b2.content
  for (let i = 1; i <= 2; i++) {
    const r = addRow(content, b2.id, { number: i, instructions: `rang ${i}` })
    content = r.content
  }

  const guide = await createGuide({ name: 'Pull test', craft: 'knitting' })
  await saveGuideContent(guide.id, content)
  return { guide, content, piece1Id: p1.id, piece2Id: p2.id, rowsBlock1Id: b1.id }
}

async function setupProjectWithGuide() {
  const project = await createTestProject()
  const { guide, content, piece1Id, piece2Id, rowsBlock1Id } = await createTwoPieceGuide()
  await linkGuideToProject(project.id, guide.id)
  return { project, guide, content, piece1Id, piece2Id, rowsBlock1Id }
}

describe('getOrCreateProgress', () => {
  it('creates exactly one record across repeated calls', async () => {
    const project = await createTestProject()
    const { guide } = await createTwoPieceGuide()

    const first = await getOrCreateProgress(project.id, guide.id)
    const second = await getOrCreateProgress(project.id, guide.id)

    expect(second.id).toBe(first.id)
    const all = await db.guideProgress.where('[projectId+guideId]').equals([project.id, guide.id]).toArray()
    expect(all).toHaveLength(1)
  })
})

describe('setActivePiece', () => {
  it('accepts the first piece, then refuses a piece out of order', async () => {
    const { project, guide, piece1Id, piece2Id } = await setupProjectWithGuide()

    const updated = await setActivePiece(project.id, guide.id, piece1Id)
    expect(updated.activePieceId).toBe(piece1Id)

    await expect(setActivePiece(project.id, guide.id, piece2Id)).rejects.toThrow()
  })
})

describe('startGuide', () => {
  it('starts a session with origin "guide" for the project, and sets the initial cursor', async () => {
    const { project, guide, piece1Id } = await setupProjectWithGuide()

    const progress = await startGuide(project.id, guide.id)

    expect(progress.activePieceId).toBe(piece1Id)
    expect(progress.pieces[piece1Id]?.cursor).not.toBeNull()
    expect(progress.pieces[piece1Id]?.status).toBe('in_progress')

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ projectId: project.id, origin: 'guide', endedAt: null })
  })

  it('does not start a session when time tracking is disabled', async () => {
    await updateSettings({ trackingEnabled: false })
    const { project, guide } = await setupProjectWithGuide()

    await startGuide(project.id, guide.id)

    expect(await db.sessions.count()).toBe(0)
  })

  it('resumes an in-progress piece instead of restarting its cursor', async () => {
    const { project, guide, piece1Id } = await setupProjectWithGuide()
    const first = await startGuide(project.id, guide.id)
    const cursorAfterFirstStart = first.pieces[piece1Id]!.cursor

    await advanceGuide(project.id, guide.id, { type: 'next' })
    const resumed = await startGuide(project.id, guide.id)

    expect(resumed.pieces[piece1Id]!.cursor).not.toEqual(cursorAfterFirstStart)
    expect(resumed.activePieceId).toBe(piece1Id)
  })

  it('auto-skips a piece with zero steps so the guide never gets stuck on it', async () => {
    const project = await createTestProject()
    let content: GuideContent = emptyGuideContent()
    const empty = addPiece(content, { name: 'Vide' })
    content = empty.content
    const real = addPiece(content, { name: 'Dos' })
    content = real.content
    const section = addSection(content, real.id, { name: 'Corps', method: 'flat' })
    content = section.content
    const block = addBlock(content, section.id, 'rows')
    content = block.content
    const row = addRow(content, block.id, { instructions: 'rang' })
    content = row.content

    const guide = await createGuide({ name: 'Guide avec pièce vide' })
    await saveGuideContent(guide.id, content)
    await linkGuideToProject(project.id, guide.id)

    const progress = await startGuide(project.id, guide.id)
    expect(progress.activePieceId).toBe(real.id)
    expect(progress.pieces[empty.id]?.status).toBe('done')
  })
})

describe('advanceGuide', () => {
  it('advances the cursor and stepsDone on "next", touching the project lastActivityAt', async () => {
    const { project, guide, piece1Id } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)
    const before = (await db.projects.get(project.id))!.lastActivityAt

    await new Promise((resolve) => setTimeout(resolve, 5))
    const updated = await advanceGuide(project.id, guide.id, { type: 'next' })

    expect(updated.pieces[piece1Id]?.stepsDone).toBe(1)
    const after = (await db.projects.get(project.id))!.lastActivityAt
    expect(after).not.toBe(before)

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1) // "next" continues the guide's own session, doesn't open a new one
  })

  it('"back" undoes the last step via history', async () => {
    const { project, guide, piece1Id } = await setupProjectWithGuide()
    const started = await startGuide(project.id, guide.id)
    const initialCursor = started.pieces[piece1Id]!.cursor

    await advanceGuide(project.id, guide.id, { type: 'next' })
    const afterBack = await advanceGuide(project.id, guide.id, { type: 'back' })

    expect(afterBack.pieces[piece1Id]?.cursor).toEqual(initialCursor)
    expect(afterBack.pieces[piece1Id]?.stepsDone).toBe(0)
  })

  it('finishes a piece and moves on to the next available one only via an explicit action', async () => {
    const { project, guide, piece1Id, piece2Id } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)

    // Piece 1 has 3 rows — 3 "next" calls finishes it.
    await advanceGuide(project.id, guide.id, { type: 'next' })
    await advanceGuide(project.id, guide.id, { type: 'next' })
    const afterLastRow = await advanceGuide(project.id, guide.id, { type: 'next' })

    expect(afterLastRow.pieces[piece1Id]?.status).toBe('done')
    expect(afterLastRow.activePieceId).toBeNull() // piece 2 isn't started automatically

    const resumed = await startGuide(project.id, guide.id)
    expect(resumed.activePieceId).toBe(piece2Id)
  })

  it('marks the guide completed once every piece is done', async () => {
    const { project, guide, piece1Id, piece2Id } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)
    for (let i = 0; i < 3; i++) await advanceGuide(project.id, guide.id, { type: 'next' })
    await startGuide(project.id, guide.id) // move on to piece 2
    for (let i = 0; i < 2; i++) await advanceGuide(project.id, guide.id, { type: 'next' })

    const final = await getProgress(project.id, guide.id)
    expect(final?.completedAt).not.toBeNull()
    expect(final?.pieces[piece1Id]?.status).toBe('done')
    expect(final?.pieces[piece2Id]?.status).toBe('done')
  })

  it('mirrors "next"/"back" on a linked counter, floored at zero, and leaves it untouched for goTo/checkpoints', async () => {
    const { project, guide } = await setupProjectWithGuide()
    const counter = await addCounter(project.id, 'Rangs manuel')
    await setLinkedCounter(project.id, guide.id, counter.id)
    await startGuide(project.id, guide.id)

    await advanceGuide(project.id, guide.id, { type: 'next' })
    expect((await db.counters.get(counter.id))?.value).toBe(1)

    await advanceGuide(project.id, guide.id, { type: 'back' })
    expect((await db.counters.get(counter.id))?.value).toBe(0)

    // Floored at zero: another "back" at the very start must not go negative.
    await advanceGuide(project.id, guide.id, { type: 'back' })
    expect((await db.counters.get(counter.id))?.value).toBe(0)
  })

  it('handles a rapid burst of concurrent "next" calls without losing or skipping a step', async () => {
    const project = await createTestProject()
    let content: GuideContent = emptyGuideContent()
    const p = addPiece(content, { name: 'Dos' })
    content = p.content
    const section = addSection(content, p.id, { name: 'Corps', method: 'flat' })
    content = section.content
    const block = addBlock(content, section.id, 'rows')
    content = block.content
    for (let i = 1; i <= 30; i++) {
      const r = addRow(content, block.id, { number: i, instructions: `rang ${i}` })
      content = r.content
    }
    const guide = await createGuide({ name: 'Longue pièce' })
    await saveGuideContent(guide.id, content)
    await linkGuideToProject(project.id, guide.id)
    await startGuide(project.id, guide.id)

    await Promise.all(Array.from({ length: 29 }, () => advanceGuide(project.id, guide.id, { type: 'next' })))

    const final = await getProgress(project.id, guide.id)
    expect(final?.pieces[p.id]?.stepsDone).toBe(29)
  })

  it('refuses "goTo" into a piece that has not been reached yet', async () => {
    const { project, guide, piece2Id } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)

    await expect(
      advanceGuide(project.id, guide.id, { type: 'goTo', pieceId: piece2Id, targetNodeId: 'whatever' }),
    ).rejects.toThrow()
  })

  it('allows "goTo" to review an already-done piece without reopening it or touching the linked counter', async () => {
    const { project, guide, piece1Id, piece2Id, rowsBlock1Id } = await setupProjectWithGuide()
    const counter = await addCounter(project.id, 'Rangs manuel')
    await setLinkedCounter(project.id, guide.id, counter.id)
    await startGuide(project.id, guide.id)
    for (let i = 0; i < 3; i++) await advanceGuide(project.id, guide.id, { type: 'next' })
    expect((await db.counters.get(counter.id))?.value).toBe(3)

    const contentRecord = await db.guideContents.get(guide.id)
    const firstRowId = contentRecord!.content.pieces.find((piece) => piece.id === piece1Id)!.sections[0]!.blocks[0]!
    void rowsBlock1Id
    const targetRowId = (firstRowId as { rows: { id: string }[] }).rows[0]!.id

    const updated = await advanceGuide(project.id, guide.id, { type: 'goTo', pieceId: piece1Id, targetNodeId: targetRowId })
    expect(updated.pieces[piece1Id]?.status).toBe('done') // still done, not reopened
    expect(updated.pieces[piece1Id]?.cursor?.nodeId).toBe(targetRowId)
    expect((await db.counters.get(counter.id))?.value).toBe(3) // untouched by review
    expect(updated.activePieceId).toBeNull() // piece 2 not started by reviewing piece 1
    void piece2Id
  })

  it('repairs the cursor automatically when the guide changed underneath it', async () => {
    const { project, guide, piece1Id, content, rowsBlock1Id } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)
    const started = await getProgress(project.id, guide.id)
    const currentRowId = started!.pieces[piece1Id]!.cursor!.nodeId

    // Simulate deleting the current row from the editor.
    const edited: GuideContent = {
      ...content,
      pieces: content.pieces.map((piece) =>
        piece.id === piece1Id
          ? {
              ...piece,
              sections: piece.sections.map((section) => ({
                ...section,
                blocks: section.blocks.map((block) =>
                  block.id === rowsBlock1Id && block.type === 'rows' ? { ...block, rows: block.rows.filter((row) => row.id !== currentRowId) } : block,
                ),
              })),
            }
          : piece,
      ),
    }
    await saveGuideContent(guide.id, edited)

    const updated = await advanceGuide(project.id, guide.id, { type: 'next' })
    expect(updated.pieces[piece1Id]?.cursor?.nodeId).not.toBe(currentRowId)
    expect(updated.pieces[piece1Id]?.cursor).not.toBeNull()
  })
})

describe('repairActiveCursor', () => {
  it('repositions the active cursor after a "Corriger" edit, without touching sessions or the linked counter', async () => {
    const { project, guide, piece1Id, content, rowsBlock1Id } = await setupProjectWithGuide()
    const counter = await addCounter(project.id, 'Rangs manuel')
    await setLinkedCounter(project.id, guide.id, counter.id)
    await startGuide(project.id, guide.id)
    const started = await getProgress(project.id, guide.id)
    const currentRowId = started!.pieces[piece1Id]!.cursor!.nodeId

    const edited: GuideContent = {
      ...content,
      pieces: content.pieces.map((piece) =>
        piece.id === piece1Id
          ? {
              ...piece,
              sections: piece.sections.map((section) => ({
                ...section,
                blocks: section.blocks.map((block) =>
                  block.id === rowsBlock1Id && block.type === 'rows' ? { ...block, rows: block.rows.filter((row) => row.id !== currentRowId) } : block,
                ),
              })),
            }
          : piece,
      ),
    }
    await saveGuideContent(guide.id, edited)

    const result = await repairActiveCursor(project.id, guide.id)
    expect(result.adjusted).toBe(true)
    expect(result.record.pieces[piece1Id]?.cursor?.nodeId).not.toBe(currentRowId)
    expect(await db.sessions.count()).toBe(1) // no new/extended session from this
    expect((await db.counters.get(counter.id))?.value).toBe(0) // untouched

    const again = await repairActiveCursor(project.id, guide.id)
    expect(again.adjusted).toBe(false)
  })

  it('is a no-op when the guide has not been started yet', async () => {
    const { project, guide } = await setupProjectWithGuide()
    const result = await repairActiveCursor(project.id, guide.id)
    expect(result.adjusted).toBe(false)
  })
})

describe('resetProgress', () => {
  it('restarting a piece cascades forward to later pieces, never to earlier ones', async () => {
    const { project, guide, piece1Id, piece2Id } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)
    for (let i = 0; i < 3; i++) await advanceGuide(project.id, guide.id, { type: 'next' })
    await startGuide(project.id, guide.id) // now on piece 2
    await advanceGuide(project.id, guide.id, { type: 'next' })

    const reset = await resetProgress(project.id, guide.id, { type: 'piece', pieceId: piece1Id })
    expect(reset.pieces[piece1Id]).toBeUndefined()
    expect(reset.pieces[piece2Id]).toBeUndefined() // cascaded forward too
    expect(reset.activePieceId).toBeNull()
  })

  it('"recommencer le guide" clears all progress but never touches sessions or counters', async () => {
    const { project, guide, piece1Id } = await setupProjectWithGuide()
    const counter = await addCounter(project.id, 'Rangs manuel')
    await setLinkedCounter(project.id, guide.id, counter.id)
    await startGuide(project.id, guide.id)
    await advanceGuide(project.id, guide.id, { type: 'next' })
    expect((await db.counters.get(counter.id))?.value).toBe(1)

    const reset = await resetProgress(project.id, guide.id, { type: 'guide' })
    expect(reset.activePieceId).toBeNull()
    expect(reset.pieces).toEqual({})
    expect((await db.counters.get(counter.id))?.value).toBe(1) // untouched
    expect(await db.sessions.count()).toBe(1) // untouched
    void piece1Id
  })
})

describe('cascades', () => {
  it('deleting a guide deletes every project’s progress through it', async () => {
    const { project, guide } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)
    expect(await db.guideProgress.count()).toBe(1)

    await deleteGuide(guide.id)
    expect(await db.guideProgress.count()).toBe(0)
  })

  it('deleting a project deletes its progress but not the guide itself', async () => {
    const { project, guide } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)

    await deleteProject(project.id)
    expect(await db.guideProgress.count()).toBe(0)
    expect(await db.guides.get(guide.id)).not.toBeUndefined()
  })

  it('unlinking a guide from a project deletes that pair’s progress only', async () => {
    const { project, guide } = await setupProjectWithGuide()
    const otherProject = await createTestProject()
    await linkGuideToProject(otherProject.id, guide.id)
    await startGuide(project.id, guide.id)
    await startGuide(otherProject.id, guide.id)
    expect(await db.guideProgress.count()).toBe(2)

    const [link] = await getProjectGuides(project.id)
    await unlinkGuideFromProject(link!.id)

    expect(await db.guideProgress.count()).toBe(1)
    expect(await getProgress(otherProject.id, guide.id)).not.toBeUndefined()
  })

  it('two projects linked to the same guide have independent progress', async () => {
    const { project, guide, piece1Id } = await setupProjectWithGuide()
    const otherProject = await createTestProject()
    await linkGuideToProject(otherProject.id, guide.id)

    await startGuide(project.id, guide.id)
    await advanceGuide(project.id, guide.id, { type: 'next' })
    await startGuide(otherProject.id, guide.id)

    const first = await getProgress(project.id, guide.id)
    const second = await getProgress(otherProject.id, guide.id)
    expect(first?.pieces[piece1Id]?.stepsDone).toBe(1)
    expect(second?.pieces[piece1Id]?.stepsDone).toBe(0)
  })
})

describe('getProjectGuideProgressInputs / computeProjectProgress integration', () => {
  it('feeds computeProjectProgress once the guide has some progress', async () => {
    const { project, guide } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)
    await advanceGuide(project.id, guide.id, { type: 'next' })

    const inputs: ProgressGuideInput[] = await getProjectGuideProgressInputs(project.id)
    expect(inputs).toHaveLength(1)
    expect(inputs[0]?.doneSteps).toBe(1)
    expect(inputs[0]?.knownSteps).toBe(5) // both pieces' known steps, guide-wide (3 + 2)

    const progress = computeProjectProgress([], inputs)
    expect(progress).toEqual({ kind: 'percent', ratio: 1 / 5 })
  })

  it('falls back to counters when no linked guide has a known step yet', async () => {
    const project = await createTestProject()
    const progress = computeProjectProgress([{ value: 5, goal: 10, isMain: true }], [])
    expect(progress).toEqual({ kind: 'percent', ratio: 0.5 })
    void project
  })
})

describe('getProjectResumeSummary', () => {
  it('returns null when nothing has been started', async () => {
    const { project, guide } = await setupProjectWithGuide()
    void guide
    expect(await getProjectResumeSummary(project.id)).toBeNull()
  })

  it('describes the active piece and percent once the guide is started', async () => {
    const { project, guide, piece1Id } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)
    await advanceGuide(project.id, guide.id, { type: 'next' })

    const summary = await getProjectResumeSummary(project.id)
    expect(summary?.guideId).toBe(guide.id)
    expect(summary?.pieceId).toBe(piece1Id)
    expect(summary?.description?.rowLabel).toBe('Rang 2')
    expect(summary?.percent).toBe(20) // 1 of 5 known steps guide-wide (3 + 2)
  })
})

// Sanity check that the pure engine and the repository agree on totals —
// exercised end-to-end through the DB rather than in-memory.
describe('getGuideProgress via the repository', () => {
  it('matches manual step counting', async () => {
    const { project, guide, piece1Id } = await setupProjectWithGuide()
    await startGuide(project.id, guide.id)
    await advanceGuide(project.id, guide.id, { type: 'next' })
    await advanceGuide(project.id, guide.id, { type: 'next' })

    const record = await getProgress(project.id, guide.id)
    const contentRecord = await db.guideContents.get(guide.id)
    const summary = getGuideProgress(contentRecord!.content, record!)
    expect(summary.done).toBe(2)
    expect(summary.total).toBe(5) // 3 rows piece 1 + 2 rows piece 2
    void piece1Id
  })
})
