import type { CSSProperties, ReactNode } from 'react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

/** Sensores padrão de arraste — toque com pequeno delay para não conflitar com o scroll. */
export function useSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )
}

/** Alça de arraste padronizada (mesmo ícone/estilo em treinos, blocos e exercícios). */
export function DragHandle({
  listeners, attributes, disabled, size = 16, className = '',
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes?: any
  disabled?: boolean
  size?: number
  className?: string
}) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label="Arrastar para reordenar"
      className={`touch-none cursor-grab active:cursor-grabbing text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-default shrink-0 ${className}`}
    >
      <GripVertical size={size} />
    </button>
  )
}

export type SortableRenderProps = {
  setNodeRef: (el: HTMLElement | null) => void
  style: CSSProperties
  /** Alça de arraste pronta — posicione onde quiser dentro do item. */
  handle: ReactNode
  isDragging: boolean
}

function SortableItem({ id, disabled, children }: {
  id: string; disabled?: boolean; children: (p: SortableRenderProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  }
  const handle = <DragHandle listeners={listeners} attributes={attributes} disabled={disabled} />
  return <>{children({ setNodeRef, style, handle, isDragging })}</>
}

/**
 * Lista reordenável por arraste (drag-and-drop) — sistema único usado em todo o app.
 * Cada item recebe `setNodeRef`/`style` (aplicar no elemento raiz) e uma `handle` pronta.
 * Ao soltar, chama `onReorder` com a lista já reordenada.
 */
export function SortableList<T>({ items, getId, onReorder, disabled, children }: {
  items: T[]
  getId: (item: T) => string
  onReorder: (items: T[]) => void
  disabled?: boolean
  children: (item: T, index: number, p: SortableRenderProps) => ReactNode
}) {
  const sensors = useSortableSensors()
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldI = items.findIndex((i) => getId(i) === active.id)
    const newI = items.findIndex((i) => getId(i) === over.id)
    if (oldI < 0 || newI < 0) return
    onReorder(arrayMove(items, oldI, newI))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        {items.map((item, i) => (
          <SortableItem key={getId(item)} id={getId(item)} disabled={disabled}>
            {(p) => children(item, i, p)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  )
}
