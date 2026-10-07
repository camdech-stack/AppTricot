import { useState } from 'react'
import { ChevronDown, ChevronRight, Flag, Play } from 'lucide-react'
import styles from './GuidePreviewTree.module.css'
import { blockTypeMeta, summarizeMeasureBlock, summarizeRepeatBlock, summarizeStitchCountBlock } from '../editor/blockTypeMeta'
import { PIECE_TYPE_LABELS, SECTION_TYPE_LABELS } from '../editor/nodeCategoryMeta'
import { summarizeOperation } from '../editor/operationMeta'
import { isContainerBlock, type Block, type GuideContent, type Piece, type Section } from '../../../data'

// Read-only twin of the editor's tree (step 5a). The editor's own cards are
// bound to drag-and-drop and editing handlers (and to @dnd-kit, which must
// stay out of any chunk it isn't needed in), so the import preview shares the
// editor's metadata — block colours/icons/summaries, category labels,
// operation summaries — but not its components.

function collectIds(content: GuideContent): { pieces: string[]; all: string[] } {
  const pieces: string[] = []
  const all: string[] = []
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      all.push(block.id)
      if (isContainerBlock(block)) walk(block.blocks)
    }
  }
  for (const piece of content.pieces) {
    pieces.push(piece.id)
    all.push(piece.id)
    for (const section of piece.sections) {
      all.push(section.id)
      walk(section.blocks)
    }
  }
  return { pieces, all }
}

function pieceLabel(piece: Piece): string {
  if (piece.name.trim()) return piece.name
  if (piece.category) return piece.category === 'other' && piece.customCategory ? piece.customCategory : PIECE_TYPE_LABELS[piece.category]
  return 'Pièce sans nom'
}

function sectionLabel(section: Section): string {
  if (section.name.trim()) return section.name
  if (section.category) return section.category === 'other' && section.customCategory ? section.customCategory : SECTION_TYPE_LABELS[section.category]
  return 'Section sans nom'
}

interface PreviewBlockProps {
  block: Block
  isOpen: (id: string) => boolean
  toggle: (id: string) => void
}

function PreviewBlock({ block, isOpen, toggle }: PreviewBlockProps) {
  const meta = blockTypeMeta(block.type)
  const Icon = meta.icon
  const style = { background: meta.colorSoftVar, borderColor: meta.colorVar }

  if (block.type === 'text') {
    return (
      <div className={styles.block} style={style}>
        <div className={styles.blockHead}>
          <Icon size={18} strokeWidth={1.75} style={{ color: meta.colorVar }} />
          <span className={styles.blockTitle}>{meta.label}</span>
        </div>
        <p className={styles.text}>{block.instructions || '—'}</p>
      </div>
    )
  }

  if (block.type === 'rows') {
    const open = isOpen(block.id)
    return (
      <div className={styles.block} style={style}>
        <button type="button" className={styles.blockToggle} onClick={() => toggle(block.id)} aria-expanded={open}>
          <Icon size={18} strokeWidth={1.75} style={{ color: meta.colorVar }} />
          <span className={styles.blockTitle}>
            {meta.label} · {block.rows.length}
          </span>
          {open ? <ChevronDown size={18} strokeWidth={1.75} /> : <ChevronRight size={18} strokeWidth={1.75} />}
        </button>
        {open && (
          <ol className={styles.rows}>
            {block.rows.map((row, index) => (
              <li key={row.id} className={row.side === 'ws' ? styles.rowWs : styles.rowRs}>
                <span className={styles.rowNumber}>{index + 1}</span>
                <span className={styles.rowText}>
                  {row.side && <strong>{row.side === 'rs' ? 'END ' : 'ENV '}</strong>}
                  {row.instructions || '—'}
                  {row.stitchesAfter != null && <em> ({row.stitchesAfter} m)</em>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    )
  }

  const summary =
    block.type === 'repeat' ? summarizeRepeatBlock(block) : block.type === 'measure' ? summarizeMeasureBlock(block) : summarizeStitchCountBlock(block)
  const open = isOpen(block.id)
  return (
    <div className={styles.block} style={style}>
      <button type="button" className={styles.blockToggle} onClick={() => toggle(block.id)} aria-expanded={open}>
        <Icon size={18} strokeWidth={1.75} style={{ color: meta.colorVar }} />
        <span className={styles.blockTitle}>{summary}</span>
        {open ? <ChevronDown size={18} strokeWidth={1.75} /> : <ChevronRight size={18} strokeWidth={1.75} />}
      </button>
      {open && (
        <>
          {(block.type === 'measure' || block.type === 'stitch_count') && block.instructions && <p className={styles.text}>{block.instructions}</p>}
          <div className={styles.children}>
            {block.blocks.length === 0 && <p className={styles.empty}>Bloc vide.</p>}
            {block.blocks.map((child) => (
              <PreviewBlock key={child.id} block={child} isOpen={isOpen} toggle={toggle} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface GuidePreviewTreeProps {
  content: GuideContent
}

export function GuidePreviewTree({ content }: GuidePreviewTreeProps) {
  const ids = collectIds(content)
  const [open, setOpen] = useState<Set<string>>(() => new Set(ids.pieces))
  const allOpen = ids.all.every((id) => open.has(id))

  const isOpen = (id: string) => open.has(id)
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className={styles.tree}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.toolbarButton} onClick={() => setOpen(allOpen ? new Set() : new Set(ids.all))}>
          {allOpen ? 'Tout plier' : 'Tout déplier'}
        </button>
      </div>

      {content.pieces.map((piece) => (
        <div key={piece.id} className={styles.piece}>
          <button type="button" className={styles.nodeToggle} onClick={() => toggle(piece.id)} aria-expanded={isOpen(piece.id)}>
            <span className={styles.nodeTitle}>{pieceLabel(piece)}</span>
            <span className={styles.nodeSub}>
              {piece.sections.length} section{piece.sections.length > 1 ? 's' : ''}
            </span>
            {isOpen(piece.id) ? <ChevronDown size={20} strokeWidth={1.75} /> : <ChevronRight size={20} strokeWidth={1.75} />}
          </button>

          {isOpen(piece.id) && (
            <div className={styles.children}>
              {piece.castOn && (
                <p className={styles.operation}>
                  <Play size={16} strokeWidth={1.75} /> {summarizeOperation(piece.castOn)}
                  {piece.castOn.note && ` — ${piece.castOn.note}`}
                </p>
              )}
              {piece.sections.map((section) => (
                <div key={section.id} className={styles.section}>
                  <button type="button" className={styles.nodeToggle} onClick={() => toggle(section.id)} aria-expanded={isOpen(section.id)}>
                    <span className={styles.nodeTitle}>{sectionLabel(section)}</span>
                    <span className={styles.nodeSub}>{section.method === 'round' ? 'en rond' : 'à plat'}</span>
                    {isOpen(section.id) ? <ChevronDown size={20} strokeWidth={1.75} /> : <ChevronRight size={20} strokeWidth={1.75} />}
                  </button>
                  {isOpen(section.id) && (
                    <div className={styles.children}>
                      {section.blocks.length === 0 && <p className={styles.empty}>Section vide.</p>}
                      {section.blocks.map((block) => (
                        <PreviewBlock key={block.id} block={block} isOpen={isOpen} toggle={toggle} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {piece.finish && (
                <p className={styles.operation}>
                  <Flag size={16} strokeWidth={1.75} /> {summarizeOperation(piece.finish)}
                  {piece.finish.note && ` — ${piece.finish.note}`}
                </p>
              )}
              {piece.notes && <p className={styles.text}>{piece.notes}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
