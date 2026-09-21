// A generic, reusable drag-to-reorder list built on @dnd-kit. Used for
// every reorderable list in the guide editor (pieces, sections within a
// piece, blocks within a section/container, rows within a rows block) —
// each instance gets its own DndContext scoped to that one list, since a
// node only ever reorders within its own parent list (see CLAUDE.md
// "moveNode dans la même liste parente").
import { createContext, useContext, type ReactNode } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import styles from './SortableList.module.css'

interface SortableListProps<T extends { id: string }> {
  items: T[]
  onReorder: (id: string, targetIndex: number) => void
  renderItem: (item: T, index: number) => ReactNode
  className?: string
}

export function SortableList<T extends { id: string }>({ items, onReorder, renderItem, className }: SortableListProps<T>) {
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
            <SortableItem key={item.id} id={item.id}>
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

function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <SortableItemContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>{children}</SortableItemContext.Provider>
    </div>
  )
}

// Renders the grip handle that starts the drag for the item it's nested
// in — never the whole card, so ordinary page scrolling is never at risk
// of being mistaken for a reorder.
export function DragHandle({ label = 'Réordonner' }: { label?: string }) {
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
      <GripVertical size={18} strokeWidth={1.75} />
    </button>
  )
}
