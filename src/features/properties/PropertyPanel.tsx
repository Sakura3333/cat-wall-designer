import { Check, Grid3X3, ImageIcon, Move3d, Rotate3D, Ruler, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEditorStore } from '../../editor/editorStore'
import { getComponentCatalogItem } from '../../domain/scene/componentCatalog'
import type { ComponentPropertyValue } from '../../domain/scene/types'
import { getSelectedPlane } from '../../domain/scene/selection'

export function PropertyPanel() {
  const project = useEditorStore((state) => state.project)
  const selectedId = useEditorStore((state) => state.selectedId)
  const updatePlaneSize = useEditorStore((state) => state.updatePlaneSize)
  const updatePlaneTextureMapping = useEditorStore((state) => state.updatePlaneTextureMapping)
  const updatePlaneTransform = useEditorStore((state) => state.updatePlaneTransform)
  const updateComponentTransform = useEditorStore((state) => state.updateComponentTransform)
  const selectedPlane = getSelectedPlane(project, selectedId)
  const selectedComponent = project.components.find((component) => component.id === selectedId) ?? null
  const selectedComponentCatalog = selectedComponent ? getComponentCatalogItem(selectedComponent.kind) : null
  const floorPlane = project.planes.find((plane) => plane.type === 'floor')
  const selectedTitle = selectedComponent ? '当前 3D 物体' : selectedPlane?.type === 'floor' ? '当前地面 plane' : '当前墙面 plane'
  const guideCounts = {
    left: project.perspectiveGuides.filter((guide) => guide.axis === 'left').length,
    right: project.perspectiveGuides.filter((guide) => guide.axis === 'right').length,
    vertical: project.perspectiveGuides.filter((guide) => guide.axis === 'vertical').length,
  }

  return (
    <aside className="floating-panel property-panel property-rail" aria-label="属性面板">
      <header className="rail-title">
        <span>属性</span>
        <strong>PLANE</strong>
      </header>

      <div className="property-rail-list">
        <PropertyPopover icon={Move3d} label="位置" title={`${selectedTitle} / 位置`}>
          {selectedComponent ? (
            <VectorEditor label="位置" value={selectedComponent.position} step={0.01} onChange={(position) => updateComponentTransform(selectedComponent.id, { position })} />
          ) : selectedPlane ? (
            <VectorEditor label="位置" value={selectedPlane.position} step={0.01} onChange={(position) => updatePlaneTransform(selectedPlane.id, { position })} />
          ) : (
            <p className="empty-text">等待生成 plane</p>
          )}
        </PropertyPopover>

        <PropertyPopover icon={Rotate3D} label="旋转" title={`${selectedTitle} / 旋转`}>
          {selectedComponent ? (
            <VectorEditor label="旋转" value={selectedComponent.rotation} step={1} onChange={(rotation) => updateComponentTransform(selectedComponent.id, { rotation })} />
          ) : selectedPlane ? (
            <VectorEditor label="旋转" value={selectedPlane.rotation} step={1} onChange={(rotation) => updatePlaneTransform(selectedPlane.id, { rotation })} />
          ) : (
            <p className="empty-text">等待生成 plane</p>
          )}
        </PropertyPopover>

        <PropertyPopover icon={Ruler} label="尺寸" title={`${selectedTitle} / 尺寸`}>
          {selectedPlane ? (
            <>
              <MeasureControl label="长" value={selectedPlane.width} min={1.8} max={6} onChange={(value) => updatePlaneSize(selectedPlane.id, 'width', value)} />
              <MeasureControl label="宽" value={selectedPlane.height} min={1.2} max={3.6} onChange={(value) => updatePlaneSize(selectedPlane.id, 'height', value)} />
            </>
          ) : selectedComponent ? (
            <VectorEditor label="尺寸" value={selectedComponent.size ?? selectedComponentCatalog?.defaultSize ?? { x: 0.46, y: 0.28, z: 0.14 }} step={0.01} onChange={(size) => updateComponentTransform(selectedComponent.id, { size })} />
          ) : (
            <p className="empty-text">等待生成 plane</p>
          )}
        </PropertyPopover>

        <PropertyPopover icon={ImageIcon} label="贴图" title={`${selectedTitle} / 贴图`}>
          {selectedPlane ? (
            <label className="texture-toggle">
              <input
                type="checkbox"
                checked={selectedPlane.textureEnabled && Boolean(selectedPlane.textureUrl)}
                disabled={!selectedPlane.textureUrl}
                onChange={(event) => updatePlaneTextureMapping(selectedPlane.id, event.target.checked)}
              />
              <span>
                <Check size={14} />
              </span>
              <strong>贴图映射</strong>
              <b>{selectedPlane.textureEnabled && selectedPlane.textureUrl ? '图片区域' : '暖色墙皮'}</b>
            </label>
          ) : selectedComponent ? (
            <ColorEditor
              label="占位颜色"
              value={selectedComponent.material?.color ?? selectedComponentCatalog?.fallbackColor ?? '#dbe7df'}
              onChange={(color) => updateComponentTransform(selectedComponent.id, { material: { ...selectedComponent.material, color } })}
            />
          ) : (
            <p className="empty-text">当前对象没有贴图属性</p>
          )}
        </PropertyPopover>

        <PropertyPopover icon={Grid3X3} label="地面" title="地面 plane">
          {floorPlane ? (
            <>
              <VectorEditor label="位置" value={floorPlane.position} step={0.01} onChange={(position) => updatePlaneTransform(floorPlane.id, { position })} />
              <VectorEditor label="旋转" value={floorPlane.rotation} step={1} onChange={(rotation) => updatePlaneTransform(floorPlane.id, { rotation })} />
              <MeasureControl label="长" value={floorPlane.width} min={2} max={7} onChange={(value) => updatePlaneSize(floorPlane.id, 'width', value)} />
              <MeasureControl label="宽" value={floorPlane.height} min={1.2} max={4.5} onChange={(value) => updatePlaneSize(floorPlane.id, 'height', value)} />
            </>
          ) : (
            <p className="empty-text">生成模型后自动显示</p>
          )}
        </PropertyPopover>

        <PropertyPopover icon={SlidersHorizontal} label="状态" title="透视与草稿状态">
          {selectedComponent && selectedComponentCatalog ? (
            <ComponentParamsEditor
              params={selectedComponent.params ?? {}}
              schema={selectedComponentCatalog.propertySchema}
              onChange={(params) => updateComponentTransform(selectedComponent.id, { params })}
            />
          ) : (
            <div className="summary-grid">
              <span>左向线</span>
              <b>{guideCounts.left}</b>
              <span>右向线</span>
              <b>{guideCounts.right}</b>
              <span>竖向线</span>
              <b>{guideCounts.vertical}</b>
              <span>FOV</span>
              <b>{project.perspectiveCalibration ? `${project.perspectiveCalibration.fovDegrees.toFixed(0)}°` : '-'}</b>
              <span>角点</span>
              <b>{project.corners.length}</b>
              <span>四边形</span>
              <b>{project.polygons.length}</b>
              <span>组件</span>
              <b>{project.components.length}</b>
            </div>
          )}
        </PropertyPopover>
      </div>
    </aside>
  )
}

function PropertyPopover({
  icon: Icon,
  label,
  title,
  children,
}: {
  icon: LucideIcon
  label: string
  title: string
  children: ReactNode
}) {
  return (
    <div className="property-popover-item">
      <button className="property-rail-button" type="button" aria-label={label} title={label}>
        <Icon />
        <span>{label}</span>
      </button>
      <section className="property-detail-panel">
        <h3>{title}</h3>
        {children}
      </section>
    </div>
  )
}

function VectorEditor({
  label,
  value,
  step,
  onChange,
}: {
  label: string
  value: { x: number; y: number; z: number }
  step: number
  onChange: (value: { x: number; y: number; z: number }) => void
}) {
  return (
    <div className="vector-editor">
      <span>{label}</span>
      <AxisInput axis="X" value={value.x} step={step} onChange={(next) => onChange({ ...value, x: next })} />
      <AxisInput axis="Y" value={value.y} step={step} onChange={(next) => onChange({ ...value, y: next })} />
      <AxisInput axis="Z" value={value.z} step={step} onChange={(next) => onChange({ ...value, z: next })} />
    </div>
  )
}

function AxisInput({ axis, value, step, onChange }: { axis: 'X' | 'Y' | 'Z'; value: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="axis-input">
      <b>{axis}</b>
      <input type="number" step={step} value={Number.isFinite(value) ? value.toFixed(step < 1 ? 2 : 0) : 0} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function MeasureControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const safeValue = Number.isFinite(value) ? value : min
  const commitValue = (next: number) => {
    if (!Number.isFinite(next)) return
    onChange(Math.min(max, Math.max(min, next)))
  }

  return (
    <label className="metric-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step="0.1" value={safeValue} onChange={(event) => commitValue(Number(event.target.value))} />
      <span className="metric-input-wrap">
        <input type="number" min={min} max={max} step="0.1" value={safeValue.toFixed(1)} onChange={(event) => commitValue(Number(event.target.value))} />
        <b>m</b>
      </span>
    </label>
  )
}

function ColorEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="axis-input color-input">
      <b>{label}</b>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function ComponentParamsEditor({
  params,
  schema,
  onChange,
}: {
  params: Record<string, ComponentPropertyValue>
  schema: Array<{ id: string; label: string; type: 'number' | 'boolean' | 'color' | 'text'; min?: number; max?: number; step?: number; unit?: string; defaultValue?: ComponentPropertyValue }>
  onChange: (params: Record<string, ComponentPropertyValue>) => void
}) {
  if (schema.length === 0) {
    return <p className="empty-text">当前组件没有专属参数</p>
  }

  return (
    <div className="component-param-list">
      {schema.map((property) => {
        const value = params[property.id] ?? property.defaultValue
        if (property.type === 'boolean') {
          return (
            <label className="texture-toggle" key={property.id}>
              <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange({ ...params, [property.id]: event.target.checked })} />
              <span>
                <Check size={14} />
              </span>
              <strong>{property.label}</strong>
              <b>{value ? '开启' : '关闭'}</b>
            </label>
          )
        }

        if (property.type === 'color') {
          return <ColorEditor key={property.id} label={property.label} value={typeof value === 'string' ? value : '#dbe7df'} onChange={(next) => onChange({ ...params, [property.id]: next })} />
        }

        if (property.type === 'number') {
          const numericValue = typeof value === 'number' ? value : Number(property.defaultValue ?? property.min ?? 0)
          return (
            <label className="axis-input" key={property.id}>
              <b>{property.label}</b>
              <input
                type="number"
                min={property.min}
                max={property.max}
                step={property.step ?? 1}
                value={numericValue}
                onChange={(event) => onChange({ ...params, [property.id]: Number(event.target.value) })}
              />
              {property.unit && <span>{property.unit}</span>}
            </label>
          )
        }

        return (
          <label className="axis-input" key={property.id}>
            <b>{property.label}</b>
            <input type="text" value={typeof value === 'string' ? value : ''} onChange={(event) => onChange({ ...params, [property.id]: event.target.value })} />
          </label>
        )
      })}
    </div>
  )
}
