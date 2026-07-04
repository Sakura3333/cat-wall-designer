import { DndContext, DragEndEvent, useDroppable } from '@dnd-kit/core'
import { PanelsTopLeft, Trash2, WandSparkles } from 'lucide-react'
import type { SceneComponentKind } from '../domain/scene/types'
import { wallTemplates } from '../domain/scene/wallTemplates'
import { AnnotationLayer } from '../features/annotation/AnnotationLayer'
import { ComponentPalette } from '../features/component-palette/ComponentPalette'
import { PropertyPanel } from '../features/properties/PropertyPanel'
import { SceneCanvas } from '../features/scene3d/SceneCanvas'
import { ImageUploadButton } from '../features/upload/ImageUploadButton'
import { Toolbar } from '../ui/panels/Toolbar'
import { ShortcutBar, useShortcutKeys } from '../ui/panels/ShortcutBar'
import { useEditorStore } from './editorStore'

export function EditorPage() {
  const addComponent = useEditorStore((state) => state.addComponent)

  function handleDragEnd(event: DragEndEvent) {
    if (event.over?.id !== 'scene-drop-zone') return
    const kind = event.active.data.current?.kind as SceneComponentKind | undefined
    if (kind) addComponent(kind)
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <main className="page-shell">
        <SceneWorkspace />
      </main>
    </DndContext>
  )
}

function SceneWorkspace() {
  useShortcutKeys()
  const { setNodeRef, isOver } = useDroppable({ id: 'scene-drop-zone' })
  const project = useEditorStore((state) => state.project)
  const mode = useEditorStore((state) => state.mode)
  const buildGeometry = useEditorStore((state) => state.buildGeometry)
  const clearSourceImage = useEditorStore((state) => state.clearSourceImage)
  const applyWallTemplate = useEditorStore((state) => state.applyWallTemplate)
  const geometryErrors = useEditorStore((state) => state.geometryErrors)
  const hasGeometry = project.planes.length > 0
  const hasImage = Boolean(project.sourceImage)
  const guideCounts = {
    left: project.perspectiveGuides.filter((guide) => guide.axis === 'left').length,
    right: project.perspectiveGuides.filter((guide) => guide.axis === 'right').length,
    vertical: project.perspectiveGuides.filter((guide) => guide.axis === 'vertical').length,
  }
  const canBuildPerspective = guideCounts.left >= 2 && guideCounts.right >= 2
  const canBuildCorners = project.corners.length > 0 && project.corners.length % 4 === 0
  const canBuildGeometry = canBuildPerspective || canBuildCorners

  return (
    <section className="editor-frame">
      <div ref={setNodeRef} className={isOver ? 'preview-stage over' : 'preview-stage'}>
        <div className="draft-texture" />
        {!hasImage && (
          <div className={hasGeometry ? 'center-upload-zone top-dock' : 'center-upload-zone'}>
            <ImageUploadButton className="upload-primary" />
            <div className="center-template-grid" aria-label="墙面模板">
              {wallTemplates.map((template) => (
                <button className="template-card" key={template.kind} type="button" onClick={() => applyWallTemplate(template.kind)}>
                  <PanelsTopLeft size={18} />
                  <strong>{template.label}</strong>
                  <span>{template.detail}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {hasImage && (
          <div className="image-action-toolbar" aria-label="图片和模型工具栏">
            <ImageUploadButton label="替换图片" className="action-pill" />
            <button className="action-pill danger" type="button" onClick={clearSourceImage}>
              <Trash2 size={17} />
              删除图片
            </button>
            {canBuildGeometry && (
              <button className="action-pill" type="button" onClick={buildGeometry}>
                <WandSparkles size={17} />
                生成透视模型
              </button>
            )}
          </div>
        )}
        {!hasGeometry && <AnnotationLayer />}
        {hasGeometry && <SceneCanvas />}
        {project.sourceImage && !hasGeometry && (
          <div className="stage-chip">
            {mode === 'marking-perspective'
              ? `透视线 左 ${guideCounts.left}/2 · 右 ${guideCounts.right}/2 · 竖 ${guideCounts.vertical}/2`
              : mode === 'marking-corners'
                ? `已标记 ${project.corners.length} 个角点`
                : '等待标注'}
          </div>
        )}
        {geometryErrors.length > 0 && (
          <div className="error-strip">
            {geometryErrors.map((error) => (
              <span key={error}>{error}</span>
            ))}
          </div>
        )}
        {(hasImage || hasGeometry) && <Toolbar compact={hasGeometry} />}
        <PropertyPanel />
        <ComponentPalette />
        <ShortcutBar />
      </div>
    </section>
  )
}
