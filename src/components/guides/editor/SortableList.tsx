// A generic, reusable drag-to-reorder list built on @dnd-kit. Used for
// every reorderable list in the guide editor (pieces, sections within a
// piece, blocks within a section/container, rows within a rows block) —
// each instance gets its own DndContext scoped to that one list, since a
// node only ever reorders within its own parent list (see CLAUDE.md
// "moveNode dans la même liste parente").
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './SortableList.module.css'

interface SortableListProps<T extends { id: string }> {
  items: T[]
  onReorder: (id: string, targetIndex: number) => void
  renderItem: (item: T, index: number) => ReactNode
  className?: string
  // Depth of the items in this list (1 = direct child of a piece/section,
  // 2 = nested one level further, etc.) — when set, each item draws an
  // organigram-style connector (a vertical trunk + a horizontal tick) back
  // to its parent's icon column, in --color-border. Omit for a top-level
  // list (pieces), which has no parent to connect to.
  connectorDepth?: number
  // Whether this list's own last item is also the last node connected to
  // the parent's trunk (the default): its line then stops short instead of
  // running the trunk's full height. Set to false when something else
  // renders after this list at the same connector depth (a piece's section
  // list, sandwiched between the montage and finition rows — see
  // PieceCard.tsx and ConnectorItem below) — the bug this fixes was the
  // trunk cutting short at the last *section* while montage/finition, not
  // part of this list, still followed it unconnected.
  connectorTerminates?: boolean
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
  connectorDepth,
  connectorTerminates = true,
}: SortableListProps<T>) {
  // A short delay before a touch starts dragging keeps a normal scroll
  // gesture from being hijacked — only the handle itself sets
  // touch-action: none (see DragHandle below).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const targetIndex = items.findIndex((item) => item.id === over.id)
    if (targetIndex === -1) return
    onReorder(String(active.id), targetIndex)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              id={item.id}
              connectorDepth={connectorDepth}
              connectorLast={connectorTerminates && index === items.length - 1}
            >
              {renderItem(item, index)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

interface SortableItemHandle {
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners: ReturnType<typeof useSortable>['listeners']
  setActivatorNodeRef: ReturnType<typeof useSortable>['setActivatorNodeRef']
}

const SortableItemContext = createContext<SortableItemHandle | null>(null)

function SortableItem({ id, children, connectorDepth, connectorLast }: { id: string; children: ReactNode; connectorDepth?: number; connectorLast?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    // CSS.Translate (not CSS.Transform) deliberately drops the scale dnd-kit
    // reports when a dragged item's measured rect differs from its layout
    // size — using Transform stretched the card's height while dragging.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    ...(connectorDepth != null ? ({ '--connector-depth': connectorDepth } as CSSProperties) : {}),
  }
  const connectorClass = connectorDepth == null ? undefined : connectorLast ? styles.connectorItemLast : styles.connectorItem

  return (
    <div ref={setNodeRef} style={style} className={connectorClass}>
      <SortableItemContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>{children}</SortableItemContext.Provider>
    </div>
  )
}

// A non-sortable sibling that still needs to draw an organigram connector
// at the same depth as a SortableList's items — the montage/finition rows
// around a piece's section list (see PieceCard.tsx), which aren't part of
// that reorderable list but visually belong to the same trunk.
export function ConnectorItem({ depth, last = false, children }: { depth: number; last?: boolean; children: ReactNode }) {
  return (
    <div className={last ? styles.connectorItemLast : styles.connectorItem} style={{ '--connector-depth': depth } as CSSProperties}>
      {children}
    </div>
  )
}

// Renders the drag handle that starts the drag for the item it's nested
// in — never the whole card, so ordinary page scrolling is never at risk
// of being mistaken for a reorder. A single colored dot rather than a grip
// icon (see CLAUDE.md "Style de blocs") — the surrounding tap zone stays at
// --tap-min regardless of how small the dot itself looks.
export function DragHandle({ label = 'Réordonner', color }: { label?: string; color?: string }) {
  const handle = useContext(SortableItemContext)
  if (!handle) return null
  return (
    <button
      type="button"
      ref={handle.setActivatorNodeRef}
      className={styles.handle}
      aria-label={label}
      {...handle.attributes}
      {...handle.listeners}
    >
      <span className={styles.dot} style={color ? { background: color } : undefined} />
    </button>
  )
}
