import { getComponentCatalogItem } from './componentCatalog'
import { getForbiddenZoneBounds } from './forbiddenZones'
import { rectExceedsPlane, rectToDrawingCoordinates, resolveComponentFootprint, type DrawingRect2, type Rect2 } from './componentFootprints'
import { roundNumber } from './planeMath'
import type { ForbiddenZone, PlaneSpec, Project, SceneComponent, Vec2, Vec3 } from './types'

export type ConstructionDrawingSet = {
  projectId: string
  projectName: string
  generatedAt: string
  sheets: ConstructionSheet[]
  billOfMaterials: BillOfMaterials
  warnings: ConstructionDrawingWarning[]
}

export type ConstructionSheet = {
  id: string
  planeId: string
  title: string
  planeType: 'wall' | 'floor'
  width: number
  height: number
  scale: number
  components: ConstructionComponentMark[]
  forbiddenZones: ConstructionForbiddenZoneMark[]
  warnings: ConstructionDrawingWarning[]
}

export type ConstructionComponentMark = {
  id: string
  componentId: string
  code: string
  name: string
  catalogName: string
  kind: string
  planeId: string
  planeName: string
  planeType: 'wall' | 'floor'
  center: Vec2
  bounds: DrawingRect2
  localBounds: Rect2
  drawingSize: {
    length: number
    width: number
  }
  size: Vec3
  rotationDegrees?: number
  unitPrice?: number
  purchaseUrls: string[]
  outsidePlane: boolean
}

export type ConstructionForbiddenZoneMark = {
  id: string
  name: string
  shape: ForbiddenZone['shape']
  bounds: DrawingRect2
  points?: Vec2[]
  center?: Vec2
  radiusX?: number
  radiusY?: number
}

export type BillOfMaterials = {
  items: BillOfMaterialsItem[]
  knownTotal: number
  pendingQuoteItemCount: number
  pendingQuoteComponentCount: number
}

export type BillOfMaterialsItem = {
  id: string
  kind: string
  name: string
  size: Vec3
  drawingSize: {
    length: number
    width: number
  }
  quantity: number
  componentCodes: string[]
  unitPrice?: number
  subtotal?: number
  purchaseUrls: string[]
}

export type ConstructionDrawingWarningReason = 'unbound-component' | 'missing-plane' | 'missing-catalog' | 'outside-plane'

export type ConstructionDrawingWarning = {
  id: string
  reason: ConstructionDrawingWarningReason
  message: string
  componentId?: string
  componentName?: string
  planeId?: string
  planeName?: string
}

export type ConstructionDrawingOptions = {
  generatedAt?: string
}

const DEFAULT_SHEET_SCALE = 100

export function buildConstructionDrawingSet(project: Project, options: ConstructionDrawingOptions = {}): ConstructionDrawingSet {
  const warnings: ConstructionDrawingWarning[] = []
  const marks = buildComponentMarks(project, warnings)
  const marksByPlane = groupByPlane(marks)
  const warningsByPlane = groupWarningsByPlane(warnings)

  const sheets = project.planes
    .filter((plane): plane is PlaneSpec & { type: 'wall' | 'floor' } => plane.type === 'wall' || plane.type === 'floor')
    .map((plane) => ({
      id: `construction-sheet-${plane.id}`,
      planeId: plane.id,
      title: `${plane.name}施工图`,
      planeType: plane.type,
      width: roundNumber(plane.width),
      height: roundNumber(plane.height),
      scale: DEFAULT_SHEET_SCALE,
      components: marksByPlane.get(plane.id) ?? [],
      forbiddenZones: buildForbiddenZoneMarks(project.forbiddenZones, plane),
      warnings: warningsByPlane.get(plane.id) ?? [],
    }))

  return {
    projectId: project.id,
    projectName: project.name,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sheets,
    billOfMaterials: buildBillOfMaterials(marks),
    warnings,
  }
}

export function buildBillOfMaterials(marks: ConstructionComponentMark[]): BillOfMaterials {
  const groups = new Map<string, BillOfMaterialsItem>()

  for (const mark of marks) {
    const key = `${mark.kind}|${sizeSignature(mark.size)}`
    const existing = groups.get(key)
    if (existing) {
      existing.quantity += 1
      existing.componentCodes.push(mark.code)
      if (existing.unitPrice !== undefined) existing.subtotal = roundMoney(existing.quantity * existing.unitPrice)
      continue
    }

    groups.set(key, {
      id: `bom-${mark.kind}-${sizeSignature(mark.size)}`,
      kind: mark.kind,
      name: mark.catalogName,
      size: mark.size,
      drawingSize: mark.drawingSize,
      quantity: 1,
      componentCodes: [mark.code],
      unitPrice: mark.unitPrice,
      subtotal: mark.unitPrice === undefined ? undefined : roundMoney(mark.unitPrice),
      purchaseUrls: mark.purchaseUrls,
    })
  }

  const items = Array.from(groups.values()).sort((a, b) => a.componentCodes[0].localeCompare(b.componentCodes[0], 'zh-CN'))
  return {
    items,
    knownTotal: roundMoney(items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0)),
    pendingQuoteItemCount: items.filter((item) => item.unitPrice === undefined).length,
    pendingQuoteComponentCount: items.reduce((sum, item) => sum + (item.unitPrice === undefined ? item.quantity : 0), 0),
  }
}

export function formatConstructionDimension(valueMeters: number) {
  if (Math.abs(valueMeters) < 1) return `${Math.round(valueMeters * 100)} cm`
  return `${valueMeters.toFixed(2)} m`
}

export function formatConstructionBounds(bounds: DrawingRect2, axis: 'x' | 'y') {
  return axis === 'x' ? `${formatConstructionDimension(bounds.minX)}-${formatConstructionDimension(bounds.maxX)}` : `${formatConstructionDimension(bounds.minY)}-${formatConstructionDimension(bounds.maxY)}`
}

export function formatPrice(value: number | undefined) {
  if (value === undefined) return '待报价'
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

function buildComponentMarks(project: Project, warnings: ConstructionDrawingWarning[]): ConstructionComponentMark[] {
  const marks: ConstructionComponentMark[] = []

  for (const component of project.components) {
    const footprint = resolveComponentFootprint(component, project.planes)
    if (!footprint) {
      warnings.push(buildComponentPlacementWarning(component, project.planes))
      continue
    }

    const catalogItem = getComponentCatalogItem(component.kind)
    if (!catalogItem) {
      warnings.push({
        id: `construction-warning-missing-catalog-${component.id}`,
        reason: 'missing-catalog',
        componentId: component.id,
        componentName: component.name,
        message: `${component.name} 的 catalog 已缺失，施工图使用实例尺寸生成，价格需要人工确认。`,
      })
    }

    const outsidePlane = rectExceedsPlane(footprint.rect, footprint.plane)
    if (outsidePlane) {
      warnings.push({
        id: `construction-warning-outside-plane-${component.id}`,
        reason: 'outside-plane',
        componentId: component.id,
        componentName: component.name,
        planeId: footprint.plane.id,
        planeName: footprint.plane.name,
        message: `${component.name} 的占用范围超出 ${footprint.plane.name} 边界。`,
      })
    }

    const bounds = rectToDrawingCoordinates(footprint.rect, footprint.plane)
    const code = `C${String(marks.length + 1).padStart(2, '0')}`
    marks.push({
      id: `construction-component-${component.id}`,
      componentId: component.id,
      code,
      name: component.name,
      catalogName: catalogItem?.label ?? component.name,
      kind: component.kind,
      planeId: footprint.plane.id,
      planeName: footprint.plane.name,
      planeType: footprint.mode,
      center: bounds.center,
      bounds,
      localBounds: footprint.rect,
      drawingSize: {
        length: roundNumber(footprint.size.x),
        width: roundNumber(footprint.mode === 'wall' ? footprint.size.y : footprint.size.z),
      },
      size: {
        x: roundNumber(footprint.size.x),
        y: roundNumber(footprint.size.y),
        z: roundNumber(footprint.size.z),
      },
      rotationDegrees: resolveInPlaneRotationDegrees(component, footprint.plane, footprint.mode),
      unitPrice: catalogItem?.referencePrice,
      purchaseUrls: catalogItem?.purchaseUrls ?? [],
      outsidePlane,
    })
  }

  return marks
}

function buildForbiddenZoneMarks(zones: ForbiddenZone[], plane: PlaneSpec): ConstructionForbiddenZoneMark[] {
  return zones
    .filter((zone) => zone.planeId === plane.id)
    .map((zone) => {
      const bounds = rectToDrawingCoordinates(getForbiddenZoneBounds(zone), plane)
      if (zone.shape === 'ellipse') {
        return {
          id: zone.id,
          name: zone.name,
          shape: zone.shape,
          bounds,
          center: zone.center ? localPointToDrawing(zone.center, plane) : bounds.center,
          radiusX: zone.radiusX,
          radiusY: zone.radiusY,
        }
      }

      return {
        id: zone.id,
        name: zone.name,
        shape: zone.shape,
        bounds,
        points: (zone.points ?? []).map((point) => localPointToDrawing(point, plane)),
      }
    })
}

function buildComponentPlacementWarning(component: SceneComponent, planes: PlaneSpec[]): ConstructionDrawingWarning {
  const requestedPlaneId = component.placement?.targetPlaneId ?? component.targetPlaneId
  const requestedPlane = requestedPlaneId ? planes.find((plane) => plane.id === requestedPlaneId) : undefined
  const reason: ConstructionDrawingWarningReason = component.placement?.mode === 'wall' || component.placement?.mode === 'floor' ? 'missing-plane' : 'unbound-component'

  return {
    id: `construction-warning-${reason}-${component.id}`,
    reason,
    componentId: component.id,
    componentName: component.name,
    planeId: requestedPlaneId,
    planeName: requestedPlane?.name,
    message:
      reason === 'missing-plane'
        ? `${component.name} 绑定的墙面/地面不存在，未纳入施工图。`
        : `${component.name} 未绑定到墙面或地面，未纳入施工图。`,
  }
}

function groupByPlane(marks: ConstructionComponentMark[]) {
  const groups = new Map<string, ConstructionComponentMark[]>()
  for (const mark of marks) {
    const group = groups.get(mark.planeId) ?? []
    group.push(mark)
    groups.set(mark.planeId, group)
  }
  return groups
}

function groupWarningsByPlane(warnings: ConstructionDrawingWarning[]) {
  const groups = new Map<string, ConstructionDrawingWarning[]>()
  for (const warning of warnings) {
    if (!warning.planeId) continue
    const group = groups.get(warning.planeId) ?? []
    group.push(warning)
    groups.set(warning.planeId, group)
  }
  return groups
}

function localPointToDrawing(point: Vec2, plane: PlaneSpec): Vec2 {
  return {
    x: roundNumber(point.x + plane.width / 2),
    y: roundNumber(point.y + plane.height / 2),
  }
}

function resolveInPlaneRotationDegrees(component: SceneComponent, plane: PlaneSpec, mode: 'wall' | 'floor') {
  const radians = mode === 'wall' ? component.rotation.z - plane.rotation.z : component.rotation.y - plane.rotation.y
  const degrees = roundNumber((radians * 180) / Math.PI)
  return Math.abs(degrees) < 0.01 ? undefined : degrees
}

function sizeSignature(size: Vec3) {
  return `${roundNumber(size.x)}x${roundNumber(size.y)}x${roundNumber(size.z)}`
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}
