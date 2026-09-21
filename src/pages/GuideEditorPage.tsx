import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronsDownUp, ChevronsUpDown, MoreHorizontal, Plus, Redo2, Undo2 } from 'lucide-react'
import styles from './GuideEditorPage.module.css'
import { IconButton, Button } from '../components/ui'
import { PdfViewerCore } from '../components/patterns/PdfViewerCore'
import { PieceCard } from '../components/guides/editor/PieceCard'
import { SortableList } from '../components/guides/editor/SortableList'
import { NodeMenuSheet } from '../components/guides/editor/NodeMenuSheet'
import { GuideMenuSheet } from '../components/guides/editor/GuideMenuSheet'
import { GuideMetaSheet } from '../components/guides/editor/GuideMetaSheet'
import { BlockTypePickerSheet } from '../components/guides/editor/BlockTypePickerSheet'
import { PasteRowsSheet } from '../components/guides/editor/PasteRowsSheet'
import { RowSheet } from '../components/guides/editor/RowSheet'
import { PieceSheet, OperationSheet, SectionSheet, TextBlockSheet, RepeatSheet, MeasureSheet, StitchCountSheet } from '../components/guides/editor/NodeFormSheets'
import { blockTypeLabel } from '../components/guides/editor/blockTypeMeta'
import { useGuideHistory } from '../components/guides/editor/useGuideHistory'
import { useGuideAutosave } from '../components/guides/editor/useGuideAutosave'
import { computeAncestorIds } from '../components/guides/editor/expandedPath'
import type { EditorController } from '../components/guides/editor/editorController'
import { useGuide } from '../hooks/useGuide'
import { useGuideLibraryContext } from '../hooks/useGuideLibraryContext'
import {
  addBlock,
  addPiece,
  addRow,
  addSection,
  canNest,
  computeNodeDepth,
  deleteGuide,
  deleteNode,
  duplicateGuide,
  duplicateNode,
  findNode,
  getGuideContent,
  getParentAndIndex,
  isContainerBlock,
  moveNode,
  setOperation,
  updateGuideMeta,
  updateNode,
  type Block,
  type BlockType,
  type GuideContent,
  type GuideRecord,
  type Piece,
  type Row,
  type Section,
  type SectionMethod,
} from '../data'

type SheetState =
  | { kind: 'piece'; id: string }
  | { kind: 'operation'; pieceId: string; slot: 'castOn' | 'finish' }
  | { kind: 'section'; id: string }
  | { kind: 'pickBlockType'; parentId: string }
  | { kind: 'text'; id: string }
  | { kind: 'repeat'; id: string }
  | { kind: 'measure'; id: string }
  | { kind: 'stitchCount'; id: string }
  | { kind: 'createRow'; blockId: string }
  | { kind: 'editRow'; blockId: string; id: string }
  | { kind: 'pasteRows'; blockId: string }
  | null

// --- Local helpers (UI-only, not worth adding to the pure data layer) ---

function blockExistsIn(blocks: Block[], id: string): boolean {
  for (const block of blocks) {
    if (block.id === id) return true
    if (isContainerBlock(block) && blockExistsIn(block.blocks, id)) return true
  }
  return false
}

function findOwningSectionMethod(content: GuideContent, blockId: string): SectionMethod | undefined {
  for (const piece of content.pieces) {
    for (const section of piece.sections) {
      if (blockExistsIn(section.blocks, blockId)) return section.method
    }
  }
  return undefined
}

function findOperationOwner(content: GuideContent, operationId: string): { pieceId: string; slot: 'castOn' | 'finish' } | undefined {
  for (const piece of content.pieces) {
    if (piece.castOn && piece.castOn.id === operationId) return { pieceId: piece.id, slot: 'castOn' }
    if (piece.finish && piece.finish.id === operationId) return { pieceId: piece.id, slot: 'finish' }
  }
  return undefined
}

interface MenuInfo {
  label: string
  hasChildren: boolean
  hasEdit: boolean
}

function describeForMenu(content: GuideContent, id: string): MenuInfo | undefined {
  const found = findNode(content, id)
  if (!found) return undefined
  if (found.kind === 'piece') {
    const piece = found.node as Piece
    return { label: piece.name || 'Pièce', hasChildren: piece.sections.length > 0, hasEdit: true }
  }
  if (found.kind === 'section') {
    const section = found.node as Section
    return { label: section.name || 'Section', hasChildren: section.blocks.length > 0, hasEdit: true }
  }
  if (found.kind === 'block') {
    const block = found.node as Block
    const hasChildren = block.type === 'rows' ? block.rows.length > 0 : isContainerBlock(block) ? block.blocks.length > 0 : false
    return { label: blockTypeLabel(block.type), hasChildren, hasEdit: block.type !== 'rows' }
  }
  if (found.kind === 'row') {
    return { label: 'Rang', hasChildren: false, hasEdit: true }
  }
  return undefined
}

function collectAllExpandableIds(content: GuideContent): string[] {
  const ids: string[] = []
  function walkBlocks(blocks: Block[]) {
    for (const block of blocks) {
      if (block.type === 'rows' || isContainerBlock(block)) ids.push(block.id)
      if (isContainerBlock(block)) walkBlocks(block.blocks)
    }
  }
  for (const piece of content.pieces) {
    ids.push(piece.id)
    for (const section of piece.sections) {
      ids.push(section.id)
      walkBlocks(section.blocks)
    }
  }
  return ids
}

function allowedBlockTypesAt(content: GuideContent, parentId: string): BlockType[] {
  const found = findNode(content, parentId)
  const parentType: 'section' | BlockType = found?.kind === 'section' ? 'section' : ((found?.node as Block | undefined)?.type ?? 'section')
  const parentDepth = computeNodeDepth(content, parentId) ?? 0
  const types: BlockType[] = ['rows', 'text', 'repeat', 'measure', 'stitch_count']
  return types.filter((type) => canNest(parentType, type, parentDepth))
}

export function GuideEditorPage() {
  const { guideId } = useParams<{ guideId: string }>()
  const guide = useGuide(guideId)
  const [content, setLoadedContent] = useState<GuideContent | undefined>(undefined)
  const loadedForRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!guideId || loadedForRef.current === guideId) return
    loadedForRef.current = guideId
    setLoadedContent(undefined)
    void getGuideContent(guideId).then((loaded) => setLoadedContent(loaded))
  }, [guideId])

  if (!guideId || !guide || !content) {
    return <div className={styles.page} />
  }

  return <GuideEditorInner key={guideId} guideId={guideId} guide={guide} initialContent={content} />
}

interface GuideEditorInnerProps {
  guideId: string
  guide: GuideRecord
  initialContent: GuideContent
}

function GuideEditorInner({ guideId, guide, initialContent }: GuideEditorInnerProps) {
  const navigate = useNavigate()
  const location = useLocation()
  // Set by the caller (project card, pattern page, guide list) so "back"
  // returns exactly where the editor was opened from — see CLAUDE.md
  // "Route de retour cohérente".
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/patrons'
  const libraryContext = useGuideLibraryContext()

  const { content, setContent, undo, redo, canUndo, canRedo } = useGuideHistory(initialContent)
  const [lastEditedNodeId, setLastEditedNodeId] = useState<string | null>(guide.lastEditedNodeId)
  const autosave = useGuideAutosave(guideId, content, lastEditedNodeId)

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(computeAncestorIds(initialContent, guide.lastEditedNodeId)))
  const [sheet, setSheet] = useState<SheetState>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [guideMenuOpen, setGuideMenuOpen] = useState(false)
  const [guideMetaOpen, setGuideMetaOpen] = useState(false)
  const [deleteToast, setDeleteToast] = useState<string | null>(null)
  // Which pane shows on a phone-width screen when the guide has a linked
  // pattern — both panes stay mounted either way so the PDF's position and
  // the tree's scroll/expand state survive switching (see CLAUDE.md
  // "Volet patron dans l'éditeur").
  const [guidePaneTab, setGuidePaneTab] = useState<'guide' | 'pattern'>('guide')
  const toastTimeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(toastTimeoutRef.current), [])

  function applyChange(next: GuideContent, editedId: string | null) {
    setContent(next)
    setLastEditedNodeId(editedId)
  }

  function expandIds(ids: string[]) {
    setExpanded((current) => {
      const next = new Set(current)
      for (const id of ids) next.add(id)
      return next
    })
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function showDeleteToast(label: string) {
    window.clearTimeout(toastTimeoutRef.current)
    setDeleteToast(label)
    toastTimeoutRef.current = window.setTimeout(() => setDeleteToast(null), 4000)
  }

  function handleEdit(id: string) {
    const found = findNode(content, id)
    if (!found) return
    if (found.kind === 'piece') {
      setSheet({ kind: 'piece', id })
      return
    }
    if (found.kind === 'operation') {
      const owner = findOperationOwner(content, id)
      if (owner) setSheet({ kind: 'operation', pieceId: owner.pieceId, slot: owner.slot })
      return
    }
    if (found.kind === 'section') {
      setSheet({ kind: 'section', id })
      return
    }
    if (found.kind === 'block') {
      const block = found.node as Block
      if (block.type === 'text') setSheet({ kind: 'text', id })
      else if (block.type === 'repeat') setSheet({ kind: 'repeat', id })
      else if (block.type === 'measure') setSheet({ kind: 'measure', id })
      else if (block.type === 'stitch_count') setSheet({ kind: 'stitchCount', id })
      return
    }
    if (found.kind === 'row') {
      const parent = getParentAndIndex(content, id)
      if (parent?.listKind === 'rows' && parent.parentId) setSheet({ kind: 'editRow', blockId: parent.parentId, id })
    }
  }

  function handleDeleteNode(id: string) {
    const info = describeForMenu(content, id)
    applyChange(deleteNode(content, id), null)
    showDeleteToast(info?.label ?? 'Élément')
  }

  const controller: EditorController = {
    isExpanded: (id) => expanded.has(id),
    toggleExpanded,
    onEdit: handleEdit,
    onOpenMenu: (id) => setMenuId(id),
    onAddOperation: (pieceId, slot) => setSheet({ kind: 'operation', pieceId, slot }),
    onAddSection: (pieceId) => {
      const result = addSection(content, pieceId)
      applyChange(result.content, result.id)
      expandIds([pieceId, result.id])
      setSheet({ kind: 'section', id: result.id })
    },
    onAddBlock: (parentId) => setSheet({ kind: 'pickBlockType', parentId }),
    onAddRow: (blockId) => setSheet({ kind: 'createRow', blockId }),
    onPasteRows: (blockId) => setSheet({ kind: 'pasteRows', blockId }),
    reorder: (id, targetIndex) => applyChange(moveNode(content, id, targetIndex), id),
  }

  function handleAddPiece() {
    const result = addPiece(content, 'Nouvelle pièce')
    applyChange(result.content, result.id)
    expandIds([result.id])
    setSheet({ kind: 'piece', id: result.id })
  }

  function handleBlockTypeSelected(parentId: string, type: BlockType) {
    const result = addBlock(content, parentId, type)
    applyChange(result.content, result.id)
    expandIds([parentId, result.id])
    if (type === 'text') setSheet({ kind: 'text', id: result.id })
    else if (type === 'repeat') setSheet({ kind: 'repeat', id: result.id })
    else if (type === 'measure') setSheet({ kind: 'measure', id: result.id })
    else if (type === 'stitch_count') setSheet({ kind: 'stitchCount', id: result.id })
    // 'rows' has nothing more to configure up front — just close the picker.
    else setSheet(null)
  }

  async function handleDuplicateGuide() {
    const copy = await duplicateGuide(guideId)
    navigate(`/guides/${copy.id}`, { replace: true })
  }

  async function handleDeleteGuide() {
    await deleteGuide(guideId)
    navigate(returnTo)
  }

  // --- Derived data for the currently open sheet/menu --------------------

  const piece = sheet?.kind === 'piece' ? (findNode(content, sheet.id)?.node as Piece | undefined) : undefined
  const operationPiece = sheet?.kind === 'operation' ? content.pieces.find((candidate) => candidate.id === sheet.pieceId) : undefined
  const section = sheet?.kind === 'section' ? (findNode(content, sheet.id)?.node as Section | undefined) : undefined
  const textBlock = sheet?.kind === 'text' ? (findNode(content, sheet.id)?.node as Extract<Block, { type: 'text' }> | undefined) : undefined
  const repeatBlock = sheet?.kind === 'repeat' ? (findNode(content, sheet.id)?.node as Extract<Block, { type: 'repeat' }> | undefined) : undefined
  const measureBlock = sheet?.kind === 'measure' ? (findNode(content, sheet.id)?.node as Extract<Block, { type: 'measure' }> | undefined) : undefined
  const stitchCountBlock = sheet?.kind === 'stitchCount' ? (findNode(content, sheet.id)?.node as Extract<Block, { type: 'stitch_count' }> | undefined) : undefined
  const editingRow = sheet?.kind === 'editRow' ? (findNode(content, sheet.id)?.node as Row | undefined) : undefined

  let createRowNumber: number | null = null
  let createRowSide: Row['side'] = null
  let createRowShowSide = false
  if (sheet?.kind === 'createRow') {
    const found = findNode(content, sheet.blockId)
    const block = found?.kind === 'block' ? (found.node as Block) : undefined
    const rows = block?.type === 'rows' ? block.rows : []
    const last = rows[rows.length - 1]
    createRowNumber = last?.number != null ? last.number + 1 : rows.length + 1
    createRowShowSide = findOwningSectionMethod(content, sheet.blockId) === 'flat'
    createRowSide = createRowShowSide && last?.side ? (last.side === 'rs' ? 'ws' : 'rs') : null
  }

  const menuInfo = menuId ? describeForMenu(content, menuId) : undefined
  const menuPosition = menuId ? getParentAndIndex(content, menuId) : undefined

  const linkedProjects =
    libraryContext?.projectGuides.filter((link) => link.guideId === guideId).map((link) => libraryContext.projects.find((project) => project.id === link.projectId)).filter((project): project is NonNullable<typeof project> => Boolean(project)) ?? []

  const saveStatusLabel = autosave.status === 'saving' ? 'Enregistrement…' : autosave.status === 'error' ? 'Échec de l’enregistrement' : 'Enregistré'
  const linkedPattern = guide.patternId ? libraryContext?.patterns.find((pattern) => pattern.id === guide.patternId) : undefined

  const guidePaneContent = (
    <>
      <div className={styles.toolbar}>
        <button type="button" className={styles.toolbarButton} onClick={() => setExpanded(new Set(collectAllExpandableIds(content)))}>
          <ChevronsUpDown size={16} strokeWidth={1.75} />
          Tout déplier
        </button>
        <button type="button" className={styles.toolbarButton} onClick={() => setExpanded(new Set())}>
          <ChevronsDownUp size={16} strokeWidth={1.75} />
          Tout plier
        </button>
      </div>

      <div className={styles.body}>
        {content.pieces.length === 0 ? (
          <p className={styles.emptyText}>Ajoute une première pièce pour commencer à écrire ce guide.</p>
        ) : (
          <SortableList
            items={content.pieces}
            onReorder={controller.reorder}
            className={styles.pieceList}
            renderItem={(pieceItem) => <PieceCard piece={pieceItem} controller={controller} />}
          />
        )}
        <Button icon={<Plus size={18} strokeWidth={1.75} />} onClick={handleAddPiece} className={styles.addPieceButton}>
          Ajouter une pièce
        </Button>
      </div>
    </>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={() => navigate(returnTo)} />
        <span className={styles.headerTitle}>{guide.name}</span>
        <span className={autosave.status === 'error' ? styles.saveStatusError : styles.saveStatus}>{saveStatusLabel}</span>
        <IconButton icon={<Undo2 strokeWidth={1.75} />} label="Annuler" disabled={!canUndo} onClick={undo} />
        <IconButton icon={<Redo2 strokeWidth={1.75} />} label="Rétablir" disabled={!canRedo} onClick={redo} />
        <IconButton icon={<MoreHorizontal strokeWidth={1.75} />} label="Menu du guide" onClick={() => setGuideMenuOpen(true)} />
      </div>

      {linkedPattern ? (
        <>
          <div className={styles.patternTabBar} role="tablist" aria-label="Guide ou patron">
            <button
              type="button"
              role="tab"
              aria-selected={guidePaneTab === 'guide'}
              className={guidePaneTab === 'guide' ? styles.patternTabActive : styles.patternTab}
              onClick={() => setGuidePaneTab('guide')}
            >
              Guide
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={guidePaneTab === 'pattern'}
              className={guidePaneTab === 'pattern' ? styles.patternTabActive : styles.patternTab}
              onClick={() => setGuidePaneTab('pattern')}
            >
              Patron
            </button>
          </div>
          <div className={styles.panes}>
            <div className={guidePaneTab === 'guide' ? styles.paneVisible : styles.paneHidden} data-pane="guide">
              {guidePaneContent}
            </div>
            <div className={guidePaneTab === 'pattern' ? styles.paneVisible : styles.paneHidden} data-pane="pattern">
              <div className={styles.patternPaneHost}>
                <PdfViewerCore patternId={linkedPattern.id} projectId={null} patternName={linkedPattern.name} />
              </div>
            </div>
          </div>
        </>
      ) : (
        guidePaneContent
      )}

      {deleteToast && (
        <div className={styles.toast}>
          <span>{deleteToast} supprimé</span>
          <button
            type="button"
            onClick={() => {
              undo()
              setDeleteToast(null)
            }}
          >
            Annuler
          </button>
        </div>
      )}

      {/* Node edit sheets */}
      {piece && sheet?.kind === 'piece' && (
        <PieceSheet
          open
          onClose={() => setSheet(null)}
          initialName={piece.name}
          initialNotes={piece.notes}
          onSave={(input) => applyChange(updateNode(content, sheet.id, input), sheet.id)}
        />
      )}

      {sheet?.kind === 'operation' && (
        <OperationSheet
          open
          onClose={() => setSheet(null)}
          slot={sheet.slot}
          initial={(sheet.slot === 'castOn' ? operationPiece?.castOn : operationPiece?.finish) ?? null}
          onSave={(input) => {
            if (!operationPiece) return
            const next = setOperation(content, operationPiece.id, sheet.slot, input)
            const updatedPiece = next.pieces.find((candidate) => candidate.id === operationPiece.id)
            const operationId = (sheet.slot === 'castOn' ? updatedPiece?.castOn : updatedPiece?.finish)?.id ?? null
            applyChange(next, operationId)
          }}
          onRemove={
            (sheet.slot === 'castOn' ? operationPiece?.castOn : operationPiece?.finish)
              ? () => {
                  if (!operationPiece) return
                  applyChange(setOperation(content, operationPiece.id, sheet.slot, null), null)
                }
              : undefined
          }
        />
      )}

      {section && sheet?.kind === 'section' && (
        <SectionSheet
          open
          onClose={() => setSheet(null)}
          initialName={section.name}
          initialMethod={section.method}
          onSave={(input) => applyChange(updateNode(content, sheet.id, input), sheet.id)}
        />
      )}

      {sheet?.kind === 'pickBlockType' && (
        <BlockTypePickerSheet
          open
          onClose={() => setSheet(null)}
          allowedTypes={allowedBlockTypesAt(content, sheet.parentId)}
          onSelect={(type) => handleBlockTypeSelected(sheet.parentId, type)}
        />
      )}

      {textBlock && sheet?.kind === 'text' && (
        <TextBlockSheet open onClose={() => setSheet(null)} initialText={textBlock.text} onSave={(text) => applyChange(updateNode(content, sheet.id, { text }), sheet.id)} />
      )}

      {repeatBlock && sheet?.kind === 'repeat' && (
        <RepeatSheet open onClose={() => setSheet(null)} initialTimes={repeatBlock.times} onSave={(times) => applyChange(updateNode(content, sheet.id, { times }), sheet.id)} />
      )}

      {measureBlock && sheet?.kind === 'measure' && (
        <MeasureSheet
          open
          onClose={() => setSheet(null)}
          initialLength={measureBlock.length}
          initialUnit={measureBlock.unit}
          initialFrom={measureBlock.from}
          onSave={(input) => applyChange(updateNode(content, sheet.id, input), sheet.id)}
        />
      )}

      {stitchCountBlock && sheet?.kind === 'stitchCount' && (
        <StitchCountSheet
          open
          onClose={() => setSheet(null)}
          initialTarget={stitchCountBlock.target}
          onSave={(target) => applyChange(updateNode(content, sheet.id, { target }), sheet.id)}
        />
      )}

      {sheet?.kind === 'createRow' && (
        <RowSheet
          open
          onClose={() => setSheet(null)}
          mode="create"
          showSide={createRowShowSide}
          initialNumber={createRowNumber}
          initialSide={createRowSide}
          onSave={(input) => {
            const result = addRow(content, sheet.blockId, input)
            applyChange(result.content, result.id)
          }}
        />
      )}

      {editingRow && sheet?.kind === 'editRow' && (
        <RowSheet
          open
          onClose={() => setSheet(null)}
          mode="edit"
          showSide={findOwningSectionMethod(content, sheet.blockId) === 'flat'}
          initialNumber={editingRow.number}
          initialSide={editingRow.side}
          initialText={editingRow.text}
          initialStitchesAfter={editingRow.stitchesAfter}
          onSave={(input) => applyChange(updateNode(content, sheet.id, { ...input }), sheet.id)}
        />
      )}

      {sheet?.kind === 'pasteRows' && (
        <PasteRowsSheet
          open
          onClose={() => setSheet(null)}
          startingNumber={pasteRowsStartingNumber(content, sheet.blockId)}
          onConfirm={(rows) => {
            let next = content
            let lastId: string | null = null
            for (const row of rows) {
              const result = addRow(next, sheet.blockId, row)
              next = result.content
              lastId = result.id
            }
            applyChange(next, lastId)
          }}
        />
      )}

      {/* Node "⋯" menu */}
      {menuId && menuInfo && (
        <NodeMenuSheet
          open
          onClose={() => setMenuId(null)}
          title={menuInfo.label}
          onEdit={menuInfo.hasEdit ? () => handleEdit(menuId) : undefined}
          onDuplicate={() => {
            const result = duplicateNode(content, menuId)
            applyChange(result.content, result.id)
          }}
          onMoveUp={() => applyChange(moveNode(content, menuId, 'up'), menuId)}
          onMoveDown={() => applyChange(moveNode(content, menuId, 'down'), menuId)}
          canMoveUp={(menuPosition?.index ?? 0) > 0}
          canMoveDown={menuPosition ? menuPosition.index < menuPosition.siblingCount - 1 : false}
          onDelete={() => handleDeleteNode(menuId)}
          hasChildren={menuInfo.hasChildren}
        />
      )}

      {/* Guide-level menu and metadata */}
      <GuideMenuSheet
        open={guideMenuOpen}
        onClose={() => setGuideMenuOpen(false)}
        onEditMeta={() => setGuideMetaOpen(true)}
        onDuplicate={() => void handleDuplicateGuide()}
        onDelete={() => void handleDeleteGuide()}
        linkedProjects={linkedProjects}
      />
      <GuideMetaSheet
        open={guideMetaOpen}
        onClose={() => setGuideMetaOpen(false)}
        guide={guide}
        patterns={libraryContext?.patterns ?? []}
        onSave={(input) => void updateGuideMeta(guideId, input)}
      />
    </div>
  )
}

// --- Content-mutation helpers that combine a few guideTree calls --------

function pasteRowsStartingNumber(content: GuideContent, blockId: string): number {
  const found = findNode(content, blockId)
  const block = found?.kind === 'block' ? (found.node as Block) : undefined
  const rows = block?.type === 'rows' ? block.rows : []
  const last = rows[rows.length - 1]
  return last?.number != null ? last.number + 1 : rows.length + 1
}
