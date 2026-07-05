import { DndContext, DragEndEvent, useDroppable } from '@dnd-kit/core'
import { Download, FileUp, PanelsTopLeft, Trash2, WandSparkles, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ComponentPlacementFeedback, SceneComponentKind } from '../domain/scene/types'
import { wallTemplates } from '../domain/scene/wallTemplates'
import { AnnotationLayer } from '../features/annotation/AnnotationLayer'
import { ComponentPalette } from '../features/component-palette/ComponentPalette'
import { PropertyPanel } from '../features/properties/PropertyPanel'
import { SceneCanvas } from '../features/scene3d/SceneCanvas'
import { ImageUploadButton } from '../features/upload/ImageUploadButton'
import { loadLatestProject, loadProject as loadPersistedProject, updateProject } from '../persistence/projectApi'
import { deserializeProject, serializeProject } from '../persistence/serializers'
import { Toolbar } from '../ui/panels/Toolbar'
import { ShortcutBar, useShortcutKeys } from '../ui/panels/ShortcutBar'
import { useEditorStore } from './editorStore'

export function EditorPage() {
  useProjectPersistence()
  const requestComponentPlacement = useEditorStore((state) => state.requestComponentPlacement)

  function handleDragEnd(event: DragEndEvent) {
    if (event.over?.id !== 'scene-drop-zone') return
    const kind = event.active.data.current?.kind as SceneComponentKind | undefined
    if (kind) requestComponentPlacement(kind, getDragEndClientPoint(event))
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <main className="page-shell">
        <SceneWorkspace />
      </main>
    </DndContext>
  )
}

function getDragEndClientPoint(event: DragEndEvent) {
  const rect = event.active.rect.current.translated ?? event.active.rect.current.initial
  if (!rect) return null

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
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
  const componentPlacementFeedback = useEditorStore((state) => state.componentPlacementFeedback)
  const clearComponentPlacementFeedback = useEditorStore((state) => state.clearComponentPlacementFeedback)
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
        <ProjectFileActions />
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
        {componentPlacementFeedback && <PlacementFeedbackStrip feedback={componentPlacementFeedback} onClose={clearComponentPlacementFeedback} />}
        {(hasImage || hasGeometry) && <Toolbar compact={hasGeometry} />}
        <PropertyPanel />
        <ComponentPalette />
        <ShortcutBar />
      </div>
    </section>
  )
}

function useProjectPersistence() {
  const loadProject = useEditorStore((state) => state.loadProject)

  useEffect(() => {
    let cancelled = false
    void loadLatestProject().then((project) => {
      if (!cancelled && project) loadProject(project)
    })
    return () => {
      cancelled = true
    }
  }, [loadProject])

  useEffect(() => {
    let saveTimer: number | undefined
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      if (state.project === previousState.project) return
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => {
        void updateProject(useEditorStore.getState().project)
      }, 300)
    })

    return () => {
      window.clearTimeout(saveTimer)
      unsubscribe()
    }
  }, [])
}

function ProjectFileActions() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const project = useEditorStore((state) => state.project)
  const loadProjectIntoStore = useEditorStore((state) => state.loadProject)

  function exportProject() {
    const blob = new Blob([serializeProject(useEditorStore.getState().project)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeFileName(project.name || project.id)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importProject(file: File | undefined) {
    if (!file) return
    try {
      const nextProject = deserializeProject(await file.text())
      await updateProject(nextProject)
      loadProjectIntoStore((await loadPersistedProject(nextProject.id)) ?? nextProject)
    } catch {
      window.alert('项目 JSON 无法读取，请检查文件格式。')
    }
  }

  return (
    <div className="project-file-toolbar" aria-label="项目文件">
      <button type="button" title="导入项目 JSON" aria-label="导入项目 JSON" onClick={() => inputRef.current?.click()}>
        <FileUp size={17} />
      </button>
      <button type="button" title="导出项目 JSON" aria-label="导出项目 JSON" onClick={exportProject}>
        <Download size={17} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          void importProject(event.target.files?.[0])
          event.currentTarget.value = ''
        }}
      />
    </div>
  )
}

function safeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-') || 'cat-wall-project'
}

function PlacementFeedbackStrip({ feedback, onClose }: { feedback: ComponentPlacementFeedback; onClose: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, feedback.level === 'error' ? 5200 : 3200)
    return () => window.clearTimeout(timeout)
  }, [feedback.id, feedback.level, onClose])

  return (
    <div className={`placement-feedback-strip ${feedback.level}`} role={feedback.level === 'error' ? 'alert' : 'status'} aria-live="polite">
      <div>
        <strong>{feedback.title}</strong>
        <span>{feedback.message}</span>
        {feedback.details && (
          <small>
            {feedback.details.map((detail) => (
              <b key={detail}>{detail}</b>
            ))}
          </small>
        )}
      </div>
      <button type="button" aria-label="关闭放置提示" title="关闭放置提示" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}
