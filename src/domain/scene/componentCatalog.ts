import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ComponentPlacementMode, ComponentPropertySchema, ComponentPropertyValue, SceneComponentKind, Vec3 } from './types'

export type ComponentPlacementGroup = {
  id: ComponentPlacementMode
  label: string
  detail: string
}

export type ComponentSubcategory = {
  id: string
  label: string
  placement: ComponentPlacementMode
}

export type ComponentCatalogItem = {
  kind: SceneComponentKind
  label: string
  detail: string
  icon: string
  placement: ComponentPlacementMode
  subcategoryId?: string
  defaultSize: Vec3
  defaultRotation: Vec3
  fallbackColor: string
  assetKey?: string
  assetUrl?: string
  purchaseUrls: string[]
  referencePrice?: number
  propertySchema: ComponentPropertySchema[]
}

type LegacyComponentCatalogItem = ComponentCatalogItem & {
  category?: string
}

export const componentPlacementGroups: ComponentPlacementGroup[] = [
  { id: 'wall', label: '墙面', detail: '组件必须与墙面有接触面' },
  { id: 'floor', label: '地面', detail: '组件必须与地面有接触面' },
  { id: 'free', label: '自由', detail: '组件可自由放置' },
]

export const defaultComponentSubcategories: ComponentSubcategory[] = [
  { id: 'wall-climb', label: '攀爬结构', placement: 'wall' },
  { id: 'wall-decor', label: '墙面装饰', placement: 'wall' },
  { id: 'wall-window', label: '窗口遮挡', placement: 'wall' },
  { id: 'floor-rest', label: '休息区', placement: 'floor' },
  { id: 'floor-feeding', label: '喂食区', placement: 'floor' },
  { id: 'free-props', label: '自由摆件', placement: 'free' },
]

export const defaultComponentCatalog: ComponentCatalogItem[] = [
  {
    kind: 'cat-shelf',
    label: '猫爬架',
    detail: '贴墙攀爬组件',
    icon: 'boxes',
    placement: 'wall',
    subcategoryId: 'wall-climb',
    defaultSize: { x: 0.72, y: 0.34, z: 0.18 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    fallbackColor: '#e7c49e',
    assetKey: 'cat-shelf-placeholder',
    purchaseUrls: [],
    referencePrice: 299,
    propertySchema: [
      { id: 'stepCount', label: '层板数', type: 'number', min: 1, max: 6, step: 1, defaultValue: 3 },
      { id: 'roundedEdges', label: '圆角边缘', type: 'boolean', defaultValue: true },
    ],
  },
  {
    kind: 'painting',
    label: '挂画',
    detail: '贴墙装饰画',
    icon: 'image',
    placement: 'wall',
    subcategoryId: 'wall-decor',
    defaultSize: { x: 0.52, y: 0.36, z: 0.08 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    fallbackColor: '#dbe7df',
    assetKey: 'painting-placeholder',
    purchaseUrls: [],
    referencePrice: 59,
    propertySchema: [
      { id: 'frameWidth', label: '画框宽度', type: 'number', min: 0.01, max: 0.08, step: 0.01, unit: 'm', defaultValue: 0.03 },
      { id: 'matColor', label: '卡纸颜色', type: 'color', defaultValue: '#f8efe1' },
    ],
  },
  {
    kind: 'cat-bed',
    label: '猫窝',
    detail: '地面休息组件',
    icon: 'boxes',
    placement: 'floor',
    subcategoryId: 'floor-rest',
    defaultSize: { x: 0.62, y: 0.24, z: 0.48 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    fallbackColor: '#dcd5e9',
    assetKey: 'cat-bed-placeholder',
    purchaseUrls: [],
    referencePrice: 129,
    propertySchema: [
      { id: 'cushionSoftness', label: '软垫厚度', type: 'number', min: 0.02, max: 0.18, step: 0.01, unit: 'm', defaultValue: 0.08 },
      { id: 'washableCover', label: '可拆洗外套', type: 'boolean', defaultValue: true },
    ],
  },
  {
    kind: 'curtain',
    label: '窗帘',
    detail: '墙面遮挡组件',
    icon: 'panel-top',
    placement: 'wall',
    subcategoryId: 'wall-window',
    defaultSize: { x: 0.58, y: 0.92, z: 0.12 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    fallbackColor: '#f2e1cf',
    assetKey: 'curtain-placeholder',
    purchaseUrls: [],
    referencePrice: 89,
    propertySchema: [
      { id: 'foldDensity', label: '褶皱密度', type: 'number', min: 1, max: 8, step: 1, defaultValue: 4 },
      { id: 'fabricColor', label: '布料颜色', type: 'color', defaultValue: '#f2e1cf' },
    ],
  },
  {
    kind: 'bowl',
    label: '食盆',
    detail: '地面喂食组件',
    icon: 'circle',
    placement: 'floor',
    subcategoryId: 'floor-feeding',
    defaultSize: { x: 0.34, y: 0.16, z: 0.34 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    fallbackColor: '#d7e4ea',
    assetKey: 'bowl-placeholder',
    purchaseUrls: [],
    referencePrice: 39,
    propertySchema: [
      { id: 'bowlDepth', label: '碗深', type: 'number', min: 0.04, max: 0.18, step: 0.01, unit: 'm', defaultValue: 0.08 },
      { id: 'antiSlip', label: '防滑底座', type: 'boolean', defaultValue: true },
    ],
  },
]

export type ComponentCatalogState = {
  components: ComponentCatalogItem[]
  subcategories: ComponentSubcategory[]
  addComponent: (component: ComponentCatalogItem) => void
  updateComponent: (kind: SceneComponentKind, patch: Partial<ComponentCatalogItem>) => void
  deleteComponent: (kind: SceneComponentKind) => void
  addSubcategory: (subcategory: ComponentSubcategory) => void
  updateSubcategory: (id: string, patch: Partial<ComponentSubcategory>) => void
  deleteSubcategory: (id: string) => void
  resetCatalog: () => void
}

export const useComponentCatalogStore = create<ComponentCatalogState>()(
  persist(
    (set) => ({
      components: defaultComponentCatalog,
      subcategories: defaultComponentSubcategories,
      addComponent: (component) =>
        set((state) => ({
          components: [...state.components.filter((item) => item.kind !== component.kind), normalizeCatalogItem(component, state.subcategories)],
        })),
      updateComponent: (kind, patch) =>
        set((state) => ({
          components: state.components.map((component) => (component.kind === kind ? normalizeCatalogItem({ ...component, ...patch }, state.subcategories) : component)),
        })),
      deleteComponent: (kind) =>
        set((state) => ({
          components: state.components.filter((component) => component.kind !== kind),
        })),
      addSubcategory: (subcategory) =>
        set((state) => ({
          subcategories: [...state.subcategories.filter((item) => item.id !== subcategory.id), normalizeSubcategory(subcategory)],
        })),
      updateSubcategory: (id, patch) =>
        set((state) => {
          const nextSubcategories = state.subcategories.map((subcategory) => (subcategory.id === id ? normalizeSubcategory({ ...subcategory, ...patch }) : subcategory))
          return {
            subcategories: nextSubcategories,
            components: state.components.map((component) => normalizeCatalogItem(component, nextSubcategories)),
          }
        }),
      deleteSubcategory: (id) =>
        set((state) => ({
          subcategories: state.subcategories.filter((subcategory) => subcategory.id !== id),
          components: state.components.map((component) => (component.subcategoryId === id ? { ...component, subcategoryId: undefined } : component)),
        })),
      resetCatalog: () => set({ components: defaultComponentCatalog, subcategories: defaultComponentSubcategories }),
    }),
    {
      name: 'cat-wall-component-catalog',
      version: 3,
      migrate: (persisted) => migrateCatalogState(persisted),
      merge: (persisted, current) => {
        const state = persisted as Partial<ComponentCatalogState> | undefined
        const subcategories = state?.subcategories?.length ? state.subcategories.map(normalizeSubcategory) : current.subcategories
        const components = state?.components?.length
          ? state.components.map((component) => normalizeCatalogItem(migrateLegacyComponent(component as LegacyComponentCatalogItem), subcategories))
          : current.components
        return {
          ...current,
          ...state,
          components,
          subcategories,
        }
      },
    },
  ),
)

export function getComponentCatalog() {
  return useComponentCatalogStore.getState().components
}

export function getComponentCatalogItem(kind: SceneComponentKind) {
  return getComponentCatalog().find((component) => component.kind === kind)
}

export function getComponentLabel(kind: SceneComponentKind) {
  return getComponentCatalogItem(kind)?.label ?? kind
}

export function getPlacementGroupLabel(placement: ComponentPlacementMode) {
  return componentPlacementGroups.find((group) => group.id === placement)?.label ?? placement
}

export function getSubcategoryLabel(subcategoryId?: string) {
  if (!subcategoryId) return '未分类'
  return useComponentCatalogStore.getState().subcategories.find((subcategory) => subcategory.id === subcategoryId)?.label ?? '未分类'
}

export function createDefaultComponentParams(kind: SceneComponentKind): Record<string, ComponentPropertyValue> {
  const item = getComponentCatalogItem(kind)
  if (!item) return {}

  return item.propertySchema.reduce<Record<string, ComponentPropertyValue>>((params, property) => {
    if (property.defaultValue !== undefined) {
      params[property.id] = property.defaultValue
    }
    return params
  }, {})
}

export function normalizeCatalogItem(component: ComponentCatalogItem, subcategories: ComponentSubcategory[] = defaultComponentSubcategories): ComponentCatalogItem {
  const placement = normalizePlacement(component.placement)
  const subcategory = subcategories.find((item) => item.id === component.subcategoryId && item.placement === placement)

  return {
    ...component,
    kind: component.kind.trim(),
    label: component.label.trim() || component.kind.trim(),
    detail: component.detail.trim(),
    icon: component.icon.trim() || 'boxes',
    placement,
    subcategoryId: subcategory?.id,
    defaultSize: normalizeVec3(component.defaultSize, { x: 0.46, y: 0.28, z: 0.14 }),
    defaultRotation: normalizeVec3(component.defaultRotation, { x: 0, y: 0, z: 0 }),
    fallbackColor: component.fallbackColor || '#dbe7df',
    purchaseUrls: normalizeUrlList(component.purchaseUrls),
    referencePrice: normalizeOptionalNumber(component.referencePrice),
    propertySchema: component.propertySchema.map((property) => ({
      ...property,
      id: property.id.trim(),
      label: property.label.trim() || property.id.trim(),
    })),
  }
}

export function normalizeSubcategory(subcategory: ComponentSubcategory): ComponentSubcategory {
  const placement = normalizePlacement(subcategory.placement)
  return {
    id: subcategory.id.trim(),
    label: subcategory.label.trim() || subcategory.id.trim(),
    placement,
  }
}

function migrateCatalogState(persisted: unknown): Partial<ComponentCatalogState> {
  const state = persisted as Partial<ComponentCatalogState> | undefined
  const subcategories = state?.subcategories?.length ? state.subcategories.map(normalizeSubcategory) : defaultComponentSubcategories
  const components = state?.components?.length
    ? state.components.map((component) => normalizeCatalogItem(migrateLegacyComponent(component as LegacyComponentCatalogItem), subcategories))
    : defaultComponentCatalog

  return {
    components,
    subcategories,
  }
}

function migrateLegacyComponent(component: LegacyComponentCatalogItem): ComponentCatalogItem {
  if (component.subcategoryId) return component
  const legacyMap: Record<string, string | undefined> = {
    wall: 'wall-decor',
    window: 'wall-window',
    floor: 'floor-rest',
    light: 'free-props',
    decor: 'free-props',
  }

  return {
    ...component,
    placement: component.placement ?? placementFromLegacyCategory(component.category),
    subcategoryId: legacyMap[component.category ?? ''],
  }
}

function placementFromLegacyCategory(category?: string): ComponentPlacementMode {
  if (category === 'floor') return 'floor'
  if (category === 'wall' || category === 'window') return 'wall'
  return 'free'
}

function normalizePlacement(placement: ComponentPlacementMode | string | undefined): ComponentPlacementMode {
  if (placement === 'floor' || placement === 'free') return placement
  return 'wall'
}

function normalizeVec3(value: Vec3, fallback: Vec3): Vec3 {
  return {
    x: Number.isFinite(value.x) ? value.x : fallback.x,
    y: Number.isFinite(value.y) ? value.y : fallback.y,
    z: Number.isFinite(value.z) ? value.z : fallback.z,
  }
}

function normalizeUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : undefined
}
