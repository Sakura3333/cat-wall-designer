import { ArrowLeft, Boxes, CopyPlus, Folder, FolderPlus, Pencil, Plus, RotateCcw, Save, ScanLine, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  componentPlacementGroups,
  normalizeCatalogItem,
  normalizeSubcategory,
  type ComponentCatalogItem,
  type ComponentSubcategory,
  useComponentCatalogStore,
} from '../../domain/scene/componentCatalog'
import { componentAssetOptions, validateComponentAssetUrl, type ComponentAssetUrlValidation } from '../../domain/scene/componentAssets'
import { normalizeComponentPropertyModelBinding } from '../../domain/scene/componentParamEffects'
import type { ComponentPlacementMode, ComponentPropertyModelBinding, ComponentPropertySchema, ComponentPropertyValue, Vec3 } from '../../domain/scene/types'
import { ComponentAssetThumbnail } from '../scene3d/ComponentAssetThumbnail'

type TreeSelection =
  | { type: 'placement'; placement: ComponentPlacementMode }
  | { type: 'subcategory'; placement: ComponentPlacementMode; subcategoryId: string }

const emptyComponent: ComponentCatalogItem = {
  kind: '',
  label: '',
  detail: '',
  icon: 'boxes',
  placement: 'wall',
  subcategoryId: undefined,
  defaultSize: { x: 0.46, y: 0.28, z: 0.14 },
  defaultRotation: { x: 0, y: 0, z: 0 },
  fallbackColor: '#dbe7df',
  assetKey: '',
  assetUrl: '',
  purchaseUrls: [],
  referencePrice: undefined,
  propertySchema: [],
}

export function ComponentsManagerPage() {
  const components = useComponentCatalogStore((state) => state.components)
  const subcategories = useComponentCatalogStore((state) => state.subcategories)
  const addComponent = useComponentCatalogStore((state) => state.addComponent)
  const updateComponent = useComponentCatalogStore((state) => state.updateComponent)
  const deleteComponent = useComponentCatalogStore((state) => state.deleteComponent)
  const addSubcategory = useComponentCatalogStore((state) => state.addSubcategory)
  const deleteSubcategory = useComponentCatalogStore((state) => state.deleteSubcategory)
  const resetCatalog = useComponentCatalogStore((state) => state.resetCatalog)
  const [selection, setSelection] = useState<TreeSelection>({ type: 'placement', placement: 'wall' })
  const [editingComponent, setEditingComponent] = useState<ComponentCatalogItem | null>(null)
  const [editingOriginalKind, setEditingOriginalKind] = useState<string | null>(null)
  const [newSubcategoryName, setNewSubcategoryName] = useState<Record<ComponentPlacementMode, string>>({ wall: '', floor: '', free: '' })
  const selectedPlacement = selection.placement
  const selectedSubcategory = selection.type === 'subcategory' ? subcategories.find((subcategory) => subcategory.id === selection.subcategoryId) : null
  const visibleComponents = useMemo(
    () =>
      components.filter((component) => {
        if (component.placement !== selection.placement) return false
        if (selection.type === 'subcategory') return component.subcategoryId === selection.subcategoryId
        return true
      }),
    [components, selection],
  )
  const currentTitle =
    selection.type === 'subcategory'
      ? `${componentPlacementGroups.find((group) => group.id === selection.placement)?.label ?? selection.placement} / ${selectedSubcategory?.label ?? '未分类'}`
      : `${componentPlacementGroups.find((group) => group.id === selection.placement)?.label ?? selection.placement}组件`

  function openNewComponent() {
    const subcategoryId = selection.type === 'subcategory' ? selection.subcategoryId : subcategories.find((subcategory) => subcategory.placement === selectedPlacement)?.id
    setEditingOriginalKind(null)
    setEditingComponent({
      ...emptyComponent,
      kind: `component-${Date.now()}`,
      label: '新组件',
      detail: '可拖入场景',
      placement: selectedPlacement,
      subcategoryId,
    })
  }

  function openDuplicate(component: ComponentCatalogItem) {
    setEditingOriginalKind(null)
    setEditingComponent({
      ...component,
      kind: `${component.kind}-copy`,
      label: `${component.label} 副本`,
    })
  }

  function saveComponent(draft: ComponentCatalogItem) {
    const normalized = normalizeCatalogItem(draft, subcategories)
    if (editingOriginalKind && editingOriginalKind !== normalized.kind) {
      deleteComponent(editingOriginalKind)
      addComponent(normalized)
    } else if (editingOriginalKind) {
      updateComponent(editingOriginalKind, normalized)
    } else {
      addComponent(normalized)
    }
    setSelection(normalized.subcategoryId ? { type: 'subcategory', placement: normalized.placement, subcategoryId: normalized.subcategoryId } : { type: 'placement', placement: normalized.placement })
    setEditingOriginalKind(null)
    setEditingComponent(null)
  }

  function createSubcategory(placement: ComponentPlacementMode) {
    const label = newSubcategoryName[placement].trim()
    if (!label) return
    const subcategory = normalizeSubcategory({
      id: `${placement}-${slugify(label) || Date.now()}`,
      label,
      placement,
    })
    addSubcategory(subcategory)
    setNewSubcategoryName({ ...newSubcategoryName, [placement]: '' })
    setSelection({ type: 'subcategory', placement, subcategoryId: subcategory.id })
  }

  function removeSubcategory(subcategory: ComponentSubcategory) {
    deleteSubcategory(subcategory.id)
    setSelection({ type: 'placement', placement: subcategory.placement })
  }

  function restoreDefaults() {
    resetCatalog()
    setSelection({ type: 'placement', placement: 'wall' })
    setEditingComponent(null)
    setEditingOriginalKind(null)
  }

  return (
    <main className="components-manager-page">
      <header className="manager-topbar">
        <a className="manager-back" href="/">
          <ArrowLeft size={18} />
          返回编辑器
        </a>
        <div>
          <span>COMPONENTS</span>
          <h1>组件管理</h1>
        </div>
        <div className="manager-actions">
          <a href="/components_manager/ai-cad">
            <ScanLine size={18} />
            AI 建模
          </a>
          <button type="button" onClick={openNewComponent}>
            <Plus size={18} />
            新增组件
          </button>
          <button type="button" onClick={restoreDefaults}>
            <RotateCcw size={18} />
            重置
          </button>
        </div>
      </header>

      <section className="manager-layout">
        <aside className="component-list-panel category-tree-panel">
          <div className="manager-panel-title">
            <span>组件分类</span>
            <b>{subcategories.length}</b>
          </div>
          <div className="category-tree">
            {componentPlacementGroups.map((group) => {
              const groupSubcategories = subcategories.filter((subcategory) => subcategory.placement === group.id)
              const groupCount = components.filter((component) => component.placement === group.id).length
              return (
                <section className="category-branch" key={group.id}>
                  <button
                    className={selection.type === 'placement' && selection.placement === group.id ? 'tree-node root active' : 'tree-node root'}
                    type="button"
                    onClick={() => setSelection({ type: 'placement', placement: group.id })}
                  >
                    <Folder size={18} />
                    <span>
                      <strong>{group.label}</strong>
                      <small>{group.detail}</small>
                    </span>
                    <b>{groupCount}</b>
                  </button>
                  <div className="subcategory-list">
                    {groupSubcategories.map((subcategory) => {
                      const count = components.filter((component) => component.subcategoryId === subcategory.id).length
                      return (
                        <div className="subcategory-row" key={subcategory.id}>
                          <button
                            className={selection.type === 'subcategory' && selection.subcategoryId === subcategory.id ? 'tree-node active' : 'tree-node'}
                            type="button"
                            onClick={() => setSelection({ type: 'subcategory', placement: group.id, subcategoryId: subcategory.id })}
                          >
                            <span>{subcategory.label}</span>
                            <b>{count}</b>
                          </button>
                          <button className="tree-delete" type="button" onClick={() => removeSubcategory(subcategory)} aria-label="删除子类">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )
                    })}
                    <label className="subcategory-add">
                      <FolderPlus size={16} />
                      <input
                        type="text"
                        placeholder="添加子类"
                        value={newSubcategoryName[group.id]}
                        onChange={(event) => setNewSubcategoryName({ ...newSubcategoryName, [group.id]: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') createSubcategory(group.id)
                        }}
                      />
                      <button type="button" onClick={() => createSubcategory(group.id)}>
                        <Plus size={14} />
                      </button>
                    </label>
                  </div>
                </section>
              )
            })}
          </div>
        </aside>

        <section className="component-editor-panel manager-list-view">
          <div className="manager-panel-title">
            <span>{currentTitle}</span>
            <b>{visibleComponents.length}</b>
          </div>
          <div className="manager-list-head">
            <div>
              <strong>{currentTitle}</strong>
              <p>{selection.type === 'placement' ? '显示该大类下的全部组件。' : '显示当前子类下的组件。'}</p>
            </div>
            <button type="button" onClick={openNewComponent}>
              <Plus size={18} />
              新增组件
            </button>
          </div>
          <div className="component-table">
            {visibleComponents.length === 0 && <p className="manager-empty">当前分类下暂无组件。</p>}
            {visibleComponents.map((component) => (
              <article className="component-table-row" key={component.kind}>
                <ComponentAssetThumbnail assetKey={component.assetKey} assetUrl={component.assetUrl} color={component.fallbackColor} label={component.label} />
                <div>
                  <strong>{component.label}</strong>
                  <small>{component.kind}</small>
                </div>
                <p>{component.detail}</p>
                <span className="component-price">{formatPrice(component.referencePrice)}</span>
                <span className="component-links">{(component.purchaseUrls ?? []).length} 个链接</span>
                <b>{subcategories.find((subcategory) => subcategory.id === component.subcategoryId)?.label ?? '未分类'}</b>
                <div className="table-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOriginalKind(component.kind)
                      setEditingComponent(component)
                    }}
                  >
                    <Pencil size={16} />
                    编辑
                  </button>
                  <button type="button" onClick={() => openDuplicate(component)}>
                    <CopyPlus size={16} />
                    复制
                  </button>
                  <button className="danger" type="button" onClick={() => deleteComponent(component.kind)}>
                    <Trash2 size={16} />
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {editingComponent && (
        <ComponentEditorModal
          components={components}
          draft={editingComponent}
          originalKind={editingOriginalKind}
          subcategories={subcategories}
          onClose={() => {
            setEditingComponent(null)
            setEditingOriginalKind(null)
          }}
          onSave={saveComponent}
        />
      )}
    </main>
  )
}

function ComponentEditorModal({
  components,
  draft,
  originalKind,
  subcategories,
  onClose,
  onSave,
}: {
  components: ComponentCatalogItem[]
  draft: ComponentCatalogItem
  originalKind: string | null
  subcategories: ComponentSubcategory[]
  onClose: () => void
  onSave: (draft: ComponentCatalogItem) => void
}) {
  const [localDraft, setLocalDraft] = useState(draft)
  const availableSubcategories = subcategories.filter((subcategory) => subcategory.placement === localDraft.placement)
  const kindExists = components.some((component) => component.kind === localDraft.kind && component.kind !== originalKind)
  const assetUrlValidation = validateComponentAssetUrl(localDraft.assetUrl)
  const canSave = localDraft.kind.trim().length > 0 && localDraft.label.trim().length > 0 && !kindExists && assetUrlValidation.valid

  function updatePlacement(placement: ComponentPlacementMode) {
    const nextSubcategory = subcategories.find((subcategory) => subcategory.placement === placement)?.id
    setLocalDraft({ ...localDraft, placement, subcategoryId: nextSubcategory })
  }

  return (
    <div className="manager-modal-backdrop" role="presentation">
      <section className="manager-modal" role="dialog" aria-modal="true" aria-label="组件编辑">
        <header className="manager-modal-head">
          <div>
            <span>COMPONENT</span>
            <h2>{originalKind ? `编辑 ${draft.label}` : '新增组件'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>

        <div className="manager-form-grid">
          <TextField label="组件 ID" value={localDraft.kind} onChange={(kind) => setLocalDraft({ ...localDraft, kind: slugify(kind) })} />
          <TextField label="名称" value={localDraft.label} onChange={(label) => setLocalDraft({ ...localDraft, label })} />
          <TextField label="描述" value={localDraft.detail} onChange={(detail) => setLocalDraft({ ...localDraft, detail })} />
          <SelectField
            label="放置大类"
            value={localDraft.placement}
            options={componentPlacementGroups.map((group) => ({ value: group.id, label: group.label }))}
            onChange={(placement) => updatePlacement(placement as ComponentPlacementMode)}
          />
          <SelectField
            label="子类"
            value={localDraft.subcategoryId ?? ''}
            options={[{ value: '', label: '未分类' }, ...availableSubcategories.map((subcategory) => ({ value: subcategory.id, label: subcategory.label }))]}
            onChange={(subcategoryId) => setLocalDraft({ ...localDraft, subcategoryId: subcategoryId || undefined })}
          />
          <TextField label="图标 key" value={localDraft.icon} onChange={(icon) => setLocalDraft({ ...localDraft, icon })} />
          <SelectField
            label="内置资产"
            value={localDraft.assetKey ?? ''}
            options={[{ value: '', label: '不使用内置资产' }, ...componentAssetOptions.map((asset) => ({ value: asset.key, label: `${asset.label} · ${asset.key}` }))]}
            onChange={(assetKey) => setLocalDraft({ ...localDraft, assetKey: assetKey || undefined })}
          />
          <TextField label="资产 URL" value={localDraft.assetUrl ?? ''} onChange={(assetUrl) => setLocalDraft({ ...localDraft, assetUrl })} />
          <NumberField label="参考价格" value={localDraft.referencePrice ?? 0} min={0} step={1} onChange={(referencePrice) => setLocalDraft({ ...localDraft, referencePrice })} />
          <ColorField label="占位颜色" value={localDraft.fallbackColor} onChange={(fallbackColor) => setLocalDraft({ ...localDraft, fallbackColor })} />
        </div>

        <div className="manager-asset-preview-row">
          <ComponentAssetThumbnail assetKey={localDraft.assetKey} assetUrl={assetUrlValidation.valid ? assetUrlValidation.normalizedUrl : localDraft.assetUrl} color={localDraft.fallbackColor} label={localDraft.label || localDraft.kind || '组件'} />
          <AssetUrlStatus validation={assetUrlValidation} assetKey={localDraft.assetKey} assetUrl={localDraft.assetUrl} />
        </div>

        <UrlListField label="购买链接" value={localDraft.purchaseUrls} onChange={(purchaseUrls) => setLocalDraft({ ...localDraft, purchaseUrls })} />

        <div className="manager-vector-grid">
          <VectorField label="默认尺寸" value={localDraft.defaultSize} step={0.01} onChange={(defaultSize) => setLocalDraft({ ...localDraft, defaultSize })} />
          <VectorField label="默认旋转" value={localDraft.defaultRotation} step={1} onChange={(defaultRotation) => setLocalDraft({ ...localDraft, defaultRotation })} />
        </div>

        <SchemaEditor schema={localDraft.propertySchema} onChange={(propertySchema) => setLocalDraft({ ...localDraft, propertySchema })} />

        {kindExists && <p className="manager-error">组件 ID 已存在，请换一个 ID。</p>}
        {!assetUrlValidation.valid && <p className="manager-error">{assetUrlValidation.message}</p>}

        <footer className="manager-savebar">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" type="button" onClick={() => onSave(localDraft)} disabled={!canSave}>
            <Save size={18} />
            保存
          </button>
        </footer>
      </section>
    </div>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="manager-field">
      <span>{label}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="manager-field">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function UrlListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <label className="manager-field manager-field-wide">
      <span>{label}</span>
      <textarea
        value={value.join('\n')}
        placeholder="每行一个 URL"
        onChange={(event) =>
          onChange(event.target.value.split(/\r?\n/))
        }
      />
    </label>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="manager-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function AssetUrlStatus({ validation, assetKey, assetUrl }: { validation: ComponentAssetUrlValidation; assetKey?: string; assetUrl?: string }) {
  const hasAssetUrl = Boolean(assetUrl?.trim())
  const assetSourceLabel = assetKey ? '优先使用内置资产；外部 URL 会保留但不会覆盖内置模型。' : hasAssetUrl ? '外部 GLB 会在卡片和 3D 场景中异步加载，失败时回退为占位盒。' : '未选择资产时使用占位盒。'

  return (
    <div className={validation.valid ? 'asset-url-status valid' : 'asset-url-status invalid'}>
      <strong>{validation.valid ? '资产状态' : 'URL 校验失败'}</strong>
      <span>{validation.valid ? assetSourceLabel : validation.message}</span>
      {validation.valid && validation.normalizedUrl && <code>{validation.normalizedUrl}</code>}
    </div>
  )
}

function VectorField({ label, value, step, onChange }: { label: string; value: Vec3; step: number; onChange: (value: Vec3) => void }) {
  return (
    <section className="manager-vector-field">
      <span>{label}</span>
      <NumberField label="X" value={value.x} step={step} onChange={(x) => onChange({ ...value, x })} />
      <NumberField label="Y" value={value.y} step={step} onChange={(y) => onChange({ ...value, y })} />
      <NumberField label="Z" value={value.z} step={step} onChange={(z) => onChange({ ...value, z })} />
    </section>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="manager-field compact">
      <span>{label}</span>
      <input type="number" min={min} max={max} step={step ?? 1} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function SchemaEditor({ schema, onChange }: { schema: ComponentPropertySchema[]; onChange: (schema: ComponentPropertySchema[]) => void }) {
  function addProperty() {
    onChange([
      ...schema,
      {
        id: `param${schema.length + 1}`,
        label: '新参数',
        type: 'number',
        min: 0,
        max: 10,
        step: 1,
        defaultValue: 1,
        modelBinding: { kind: 'none' },
      },
    ])
  }

  function updateProperty(index: number, patch: Partial<ComponentPropertySchema>) {
    onChange(schema.map((property, itemIndex) => (itemIndex === index ? { ...property, ...patch } : property)))
  }

  function deleteProperty(index: number) {
    onChange(schema.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <section className="schema-editor">
      <div className="manager-panel-title">
        <span>组件属性</span>
        <button type="button" onClick={addProperty}>
          <Plus size={16} />
          添加属性
        </button>
      </div>
      <div className="schema-list">
        {schema.length === 0 && <p className="manager-empty">暂无专属属性。</p>}
        {schema.map((property, index) => (
          <article className={property.type === 'number' ? 'schema-row number' : 'schema-row simple'} key={`${property.id}-${index}`}>
            <TextField label="属性 ID" value={property.id} onChange={(id) => updateProperty(index, { id: slugify(id) })} />
            <TextField label="显示名" value={property.label} onChange={(label) => updateProperty(index, { label })} />
            <SelectField
              label="类型"
              value={property.type}
              options={[
                { value: 'number', label: '数字' },
                { value: 'boolean', label: '开关' },
                { value: 'color', label: '颜色' },
                { value: 'text', label: '文本' },
              ]}
              onChange={(type) => updateProperty(index, { type: type as ComponentPropertySchema['type'], defaultValue: defaultValueForType(type as ComponentPropertySchema['type']), modelBinding: { kind: 'none' } })}
            />
            {property.type === 'number' && (
              <>
                <NumberField label="最小" value={property.min ?? 0} step={property.step ?? 1} onChange={(min) => updateProperty(index, { min })} />
                <NumberField label="最大" value={property.max ?? 10} step={property.step ?? 1} onChange={(max) => updateProperty(index, { max })} />
                <NumberField label="步进" value={property.step ?? 1} step={0.01} onChange={(step) => updateProperty(index, { step })} />
              </>
            )}
            <DefaultValueField property={property} onChange={(defaultValue) => updateProperty(index, { defaultValue })} />
            <ModelBindingEditor property={property} onChange={(modelBinding) => updateProperty(index, { modelBinding })} />
            <button className="schema-delete" type="button" onClick={() => deleteProperty(index)} aria-label="删除属性">
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function ModelBindingEditor({ property, onChange }: { property: ComponentPropertySchema; onChange: (binding: ComponentPropertyModelBinding) => void }) {
  const binding = normalizeBindingForProperty(property)
  const bindingOptions = bindingOptionsForProperty(property.type)

  return (
    <div className="model-binding-editor">
      <SelectField
        label="模型作用"
        value={binding.kind}
        options={bindingOptions}
        onChange={(kind) => onChange(defaultBindingForKind(kind as ComponentPropertyModelBinding['kind'], property))}
      />
      {binding.kind === 'material-color' && (
        <TextField label="材质/部件名" value={binding.target ?? ''} onChange={(target) => onChange({ ...binding, target })} />
      )}
      {binding.kind === 'part-visibility' && (
        <>
          <TextField label="部件名" value={binding.target} onChange={(target) => onChange({ ...binding, target })} />
          <SelectField
            label="可见条件"
            value={binding.visibleWhen === false ? 'false' : 'true'}
            options={[
              { value: 'true', label: '开启时可见' },
              { value: 'false', label: '关闭时可见' },
            ]}
            onChange={(visibleWhen) => onChange({ ...binding, visibleWhen: visibleWhen === 'true' })}
          />
        </>
      )}
      {binding.kind === 'size-axis' && (
        <SelectField
          label="尺寸轴"
          value={binding.axis}
          options={[
            { value: 'x', label: 'X / 宽' },
            { value: 'y', label: 'Y / 高' },
            { value: 'z', label: 'Z / 深' },
          ]}
          onChange={(axis) => onChange({ kind: 'size-axis', axis: axis as 'x' | 'y' | 'z' })}
        />
      )}
    </div>
  )
}

function normalizeBindingForProperty(property: ComponentPropertySchema) {
  const binding = normalizeComponentPropertyModelBinding(property.modelBinding)
  if (binding.kind === 'material-color' && property.type !== 'color') return { kind: 'none' } satisfies ComponentPropertyModelBinding
  if (binding.kind === 'part-visibility' && property.type !== 'boolean') return { kind: 'none' } satisfies ComponentPropertyModelBinding
  if (binding.kind === 'size-axis' && property.type !== 'number') return { kind: 'none' } satisfies ComponentPropertyModelBinding
  return binding
}

function bindingOptionsForProperty(type: ComponentPropertySchema['type']) {
  const options = [{ value: 'none', label: '无' }]
  if (type === 'color') options.push({ value: 'material-color', label: '材质颜色' })
  if (type === 'boolean') options.push({ value: 'part-visibility', label: '部件显隐' })
  if (type === 'number') options.push({ value: 'size-axis', label: '尺寸轴' })
  return options
}

function defaultBindingForKind(kind: ComponentPropertyModelBinding['kind'], property: ComponentPropertySchema): ComponentPropertyModelBinding {
  if (kind === 'material-color' && property.type === 'color') return { kind: 'material-color' }
  if (kind === 'part-visibility' && property.type === 'boolean') return { kind: 'part-visibility', target: '', visibleWhen: true }
  if (kind === 'size-axis' && property.type === 'number') return { kind: 'size-axis', axis: 'x' }
  return { kind: 'none' }
}

function DefaultValueField({ property, onChange }: { property: ComponentPropertySchema; onChange: (value: ComponentPropertyValue) => void }) {
  if (property.type === 'boolean') {
    return (
      <label className="manager-field compact">
        <span>默认值</span>
        <select value={property.defaultValue === false ? 'false' : 'true'} onChange={(event) => onChange(event.target.value === 'true')}>
          <option value="true">开启</option>
          <option value="false">关闭</option>
        </select>
      </label>
    )
  }

  if (property.type === 'color') {
    return <ColorField label="默认值" value={typeof property.defaultValue === 'string' ? property.defaultValue : '#dbe7df'} onChange={onChange} />
  }

  if (property.type === 'number') {
    return <NumberField label="默认值" value={typeof property.defaultValue === 'number' ? property.defaultValue : 0} step={property.step ?? 1} onChange={onChange} />
  }

  return <TextField label="默认值" value={typeof property.defaultValue === 'string' ? property.defaultValue : ''} onChange={onChange} />
}

function defaultValueForType(type: ComponentPropertySchema['type']): ComponentPropertyValue {
  if (type === 'boolean') return true
  if (type === 'color') return '#dbe7df'
  if (type === 'number') return 1
  return ''
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatPrice(value?: number) {
  if (!Number.isFinite(value)) return '-'
  return `¥${Number(value).toFixed(0)}`
}
