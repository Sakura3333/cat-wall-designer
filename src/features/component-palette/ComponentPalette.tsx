import { useDraggable } from '@dnd-kit/core'
import { Boxes } from 'lucide-react'
import { useEditorStore } from '../../editor/editorStore'
import { componentPlacementGroups, useComponentCatalogStore } from '../../domain/scene/componentCatalog'
import type { SceneComponentKind } from '../../domain/scene/types'

export function ComponentPalette() {
  const activeCategory = useEditorStore((state) => state.activeCategory)
  const setActiveCategory = useEditorStore((state) => state.setActiveCategory)
  const components = useComponentCatalogStore((state) => state.components)
  const visibleComponents = components.filter((component) => component.placement === activeCategory)

  return (
    <aside className="floating-panel component-panel">
      <header className="panel-title">
        <span>组件面板</span>
        <strong>DRAG & DROP</strong>
      </header>
      <div className="palette-tabs" role="tablist" aria-label="组件分类">
        {componentPlacementGroups.map((group) => (
          <button className={group.id === activeCategory ? 'active' : ''} key={group.id} type="button" onClick={() => setActiveCategory(group.id)}>
            {group.label}
          </button>
        ))}
      </div>
      <div className="component-strip">
        {visibleComponents.map((component) => (
          <DraggableComponent key={component.kind} kind={component.kind} label={component.label} detail={component.detail} />
        ))}
      </div>
    </aside>
  )
}

function DraggableComponent({ kind, label, detail }: { kind: SceneComponentKind; label: string; detail: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: kind, data: { kind } })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <button ref={setNodeRef} className={isDragging ? 'component-card dragging' : 'component-card'} style={style} type="button" {...listeners} {...attributes}>
      <Boxes size={18} />
      <strong>{label}</strong>
      <span>{detail}</span>
    </button>
  )
}
