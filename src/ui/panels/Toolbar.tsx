import { Circle, GitCommitHorizontal, Lock, MousePointer2, Move3d, Redo2, Rotate3D, RotateCcw, Ruler, Square, Trash2, Undo2, Unlock } from 'lucide-react'
import { useEditorStore } from '../../editor/editorStore'
import type { ForbiddenZoneDrawMode, PerspectiveAxis, TransformMode } from '../../domain/scene/types'

const axisButtons: Array<{ axis: PerspectiveAxis; label: string; title: string }> = [
  { axis: 'left', label: '左向线', title: '标记左侧墙面或地面方向的透视线' },
  { axis: 'right', label: '右向线', title: '标记右侧墙面或地面方向的透视线' },
  { axis: 'vertical', label: '竖向线', title: '标记墙角、门框等竖直线' },
]

const transformButtons: Array<{ mode: TransformMode; label: string; title: string; icon: typeof MousePointer2 }> = [
  { mode: 'select', label: '选择', title: '选择场景中的物体', icon: MousePointer2 },
  { mode: 'translate', label: '移动', title: '移动 3D 物体', icon: Move3d },
  { mode: 'rotate', label: '旋转', title: '旋转 3D 物体', icon: Rotate3D },
]

const forbiddenZoneButtons: Array<{ mode: ForbiddenZoneDrawMode; label: string; title: string; icon: typeof Square }> = [
  { mode: 'rectangle', label: '矩形禁区', title: '绘制矩形禁止摆放区域', icon: Square },
  { mode: 'ellipse', label: '椭圆禁区', title: '绘制椭圆禁止摆放区域', icon: Circle },
]

export function Toolbar({ compact = false }: { compact?: boolean }) {
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const resetCorners = useEditorStore((state) => state.resetCorners)
  const mode = useEditorStore((state) => state.mode)
  const setMode = useEditorStore((state) => state.setMode)
  const createRuler = useEditorStore((state) => state.createRuler)
  const createPerspectiveGuide = useEditorStore((state) => state.createPerspectiveGuide)
  const setPerspectiveAxis = useEditorStore((state) => state.setPerspectiveAxis)
  const activePerspectiveAxis = useEditorStore((state) => state.activePerspectiveAxis)
  const transformMode = useEditorStore((state) => state.transformMode)
  const setTransformMode = useEditorStore((state) => state.setTransformMode)
  const forbiddenZoneDrawMode = useEditorStore((state) => state.forbiddenZoneDrawMode)
  const setForbiddenZoneDrawMode = useEditorStore((state) => state.setForbiddenZoneDrawMode)
  const forbiddenZonesLocked = useEditorStore((state) => state.forbiddenZonesLocked)
  const setForbiddenZonesLocked = useEditorStore((state) => state.setForbiddenZonesLocked)
  const selectedId = useEditorStore((state) => state.selectedId)
  const deleteSelectedSceneObject = useEditorStore((state) => state.deleteSelectedSceneObject)
  const historyLength = useEditorStore((state) => state.history.length)
  const futureLength = useEditorStore((state) => state.future.length)
  const showMeasurements = useEditorStore((state) => state.project.settings.showMeasurements ?? true)
  const toggleMeasurements = useEditorStore((state) => state.toggleMeasurements)
  const ForbiddenZoneLockIcon = forbiddenZonesLocked ? Lock : Unlock

  if (compact) {
    return (
      <aside className="floating-panel toolbar-panel compact-toolbar" aria-label="3D 操作工具栏">
        {transformButtons.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.mode}
              className={transformMode === item.mode ? 'compact-tool-button active' : 'compact-tool-button'}
              type="button"
              aria-label={item.label}
              title={item.title}
              onClick={() => setTransformMode(item.mode)}
            >
              <Icon />
            </button>
          )
        })}
        {forbiddenZoneButtons.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.mode}
              className={forbiddenZoneDrawMode === item.mode ? 'compact-tool-button active' : 'compact-tool-button'}
              type="button"
              aria-label={item.label}
              title={item.title}
              onClick={() => setForbiddenZoneDrawMode(forbiddenZoneDrawMode === item.mode ? 'select' : item.mode)}
            >
              <Icon />
            </button>
          )
        })}
        <button
          className={forbiddenZonesLocked ? 'compact-tool-button locked' : 'compact-tool-button unlocked'}
          type="button"
          aria-label={forbiddenZonesLocked ? '解锁禁用区域' : '锁定禁用区域'}
          title={forbiddenZonesLocked ? '当前已锁定，点击解锁后可移动区域和锚点' : '当前已解锁，点击锁定后禁止自由移动'}
          onClick={() => setForbiddenZonesLocked(!forbiddenZonesLocked)}
        >
          <ForbiddenZoneLockIcon />
        </button>
        <span className="compact-divider" />
        <button
          className={showMeasurements ? 'compact-tool-button active' : 'compact-tool-button'}
          type="button"
          aria-label="测距"
          title={showMeasurements ? '隐藏 3D 距离测量' : '显示 3D 距离测量'}
          onClick={() => toggleMeasurements(!showMeasurements)}
        >
          <Ruler />
        </button>
        <span className="compact-divider" />
        <button className="compact-tool-button" type="button" aria-label="撤销" title="撤销" onClick={undo} disabled={historyLength === 0}>
          <Undo2 />
        </button>
        <button className="compact-tool-button" type="button" aria-label="重做" title="重做" onClick={redo} disabled={futureLength === 0}>
          <Redo2 />
        </button>
        <span className="compact-divider" />
        <button className="compact-tool-button danger" type="button" aria-label="删除" title="删除选中的 3D 物体 (D)" onClick={deleteSelectedSceneObject} disabled={!selectedId}>
          <Trash2 />
        </button>
      </aside>
    )
  }

  return (
    <aside className="floating-panel toolbar-panel">
      <header className="panel-title">
        <span>3D 编辑</span>
        <strong>TOOLS</strong>
      </header>

      <section className="tool-section">
        <div className="tool-group-label">变换工具</div>
        <div className="transform-grid">
          {transformButtons.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.mode}
                className={transformMode === item.mode ? 'tool-button active transform-button' : 'tool-button transform-button'}
                type="button"
                title={item.title}
                onClick={() => setTransformMode(item.mode)}
              >
                <Icon />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="tool-section">
        <div className="tool-group-label">透视标线</div>
        {axisButtons.map((item) => (
          <button
            className={mode === 'marking-perspective' && activePerspectiveAxis === item.axis ? `tool-button active perspective-${item.axis}` : `tool-button perspective-${item.axis}`}
            key={item.axis}
            type="button"
            title={item.title}
            onClick={() => {
              setPerspectiveAxis(item.axis)
              createPerspectiveGuide(item.axis)
            }}
          >
            <GitCommitHorizontal />
            <span>{item.label}</span>
          </button>
        ))}
      </section>

      <section className="tool-section">
        <div className="tool-group-label">标尺与辅助</div>
        <button className={mode === 'marking-corners' ? 'tool-button active' : 'tool-button'} type="button" title="兼容旧流程：四点生成一个墙面" onClick={() => setMode('marking-corners')}>
          <MousePointer2 />
          <span>四点墙面</span>
        </button>
        <button className={mode === 'marking-ruler' ? 'tool-button active ruler-tool' : 'tool-button ruler-tool'} type="button" title="标尺" onClick={createRuler}>
          <Ruler />
          <span>标尺</span>
        </button>
        <button className={showMeasurements ? 'tool-button active ruler-tool' : 'tool-button ruler-tool'} type="button" title={showMeasurements ? '隐藏 3D 距离测量' : '显示 3D 距离测量'} onClick={() => toggleMeasurements(!showMeasurements)}>
          <Ruler />
          <span>测距</span>
        </button>
        <div className="tool-button tool-duo" role="group" aria-label="撤销和重做">
          <span className="icon-pair">
            <button type="button" title="撤销" onClick={undo} disabled={historyLength === 0}>
              <Undo2 />
            </button>
            <button type="button" title="重做" onClick={redo} disabled={futureLength === 0}>
              <Redo2 />
            </button>
          </span>
          <span>撤销 / 重做</span>
        </div>
        <button className="tool-button" type="button" title="清空标注" onClick={resetCorners}>
          <RotateCcw />
          <span>清空标注</span>
        </button>
      </section>
    </aside>
  )
}
