import { useDraggable } from '@dnd-kit/core'
import { useEffect, useMemo, useState, type WheelEvent } from 'react'
import { useEditorStore } from '../../editor/editorStore'
import { componentPlacementGroups, useComponentCatalogStore } from '../../domain/scene/componentCatalog'
import type { SceneComponentKind } from '../../domain/scene/types'
import { ComponentAssetThumbnail } from '../scene3d/ComponentAssetThumbnail'

export function ComponentPalette() {
  const activeCategory = useEditorStore((state) => state.activeCategory)
  const setActiveCategory = useEditorStore((state) => state.setActiveCategory)
  const components = useComponentCatalogStore((state) => state.components)
  const subcategories = useComponentCatalogStore((state) => state.subcategories)
  const [activeSubcategoryId, setActiveSubcategoryId] = useState('all')
  const visibleSubcategories = useMemo(() => subcategories.filter((subcategory) => subcategory.placement === activeCategory), [activeCategory, subcategories])
  const visibleComponents = useMemo(
    () =>
      components.filter((component) => {
        if (component.placement !== activeCategory) return false
        return activeSubcategoryId === 'all' || component.subcategoryId === activeSubcategoryId
      }),
    [activeCategory, activeSubcategoryId, components],
  )

  useEffect(() => {
    setActiveSubcategoryId('all')
  }, [activeCategory])

  useEffect(() => {
    if (activeSubcategoryId !== 'all' && !visibleSubcategories.some((subcategory) => subcategory.id === activeSubcategoryId)) {
      setActiveSubcategoryId('all')
    }
  }, [activeSubcategoryId, visibleSubcategories])

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
      <div className="palette-subtabs" role="tablist" aria-label="组件小分类" onWheel={handleHorizontalWheel}>
        <button className={activeSubcategoryId === 'all' ? 'active' : ''} type="button" onClick={() => setActiveSubcategoryId('all')}>
          全部
        </button>
        {visibleSubcategories.map((subcategory) => (
          <button className={activeSubcategoryId === subcategory.id ? 'active' : ''} key={subcategory.id} type="button" onClick={() => setActiveSubcategoryId(subcategory.id)}>
            {subcategory.label}
          </button>
        ))}
      </div>
      <div className="component-strip" onWheel={handleHorizontalWheel}>
        {visibleComponents.map((component) => (
          <DraggableComponent key={component.kind} kind={component.kind} label={component.label} detail={component.detail} color={component.fallbackColor} assetKey={component.assetKey} assetUrl={component.assetUrl} />
        ))}
      </div>
    </aside>
  )
}

function handleHorizontalWheel(event: WheelEvent<HTMLElement>) {
  const target = event.currentTarget
  if (target.scrollWidth <= target.clientWidth) return
  const dominantDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX
  if (dominantDelta === 0) return
  target.scrollLeft += dominantDelta
  event.preventDefault()
}

function DraggableComponent({ kind, label, detail, color, assetKey, assetUrl }: { kind: SceneComponentKind; label: string; detail: string; color: string; assetKey?: string; assetUrl?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: kind, data: { kind } })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <button ref={setNodeRef} className={isDragging ? 'component-card dragging' : 'component-card'} style={style} type="button" {...listeners} {...attributes}>
      <ComponentAssetThumbnail assetKey={assetKey} assetUrl={assetUrl} color={color} label={label} />
      <span className="component-card-copy">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </button>
  )
}
