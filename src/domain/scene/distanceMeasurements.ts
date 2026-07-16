import { FLOOR_THICKNESS, WALL_THICKNESS } from '../geometry/planeGeometryConstants'
import { getComponentCatalogItem } from './componentCatalog'
import { resolveComponentFootprint, type ComponentFootprint, type Rect2 } from './componentFootprints'
import { getForbiddenZoneBounds } from './forbiddenZones'
import { addVec3, planeLocalToWorld, planeSurfaceNormal, roundNumber, roundVec3, scaleVec3 } from './planeMath'
import type { ForbiddenZone, PlaneSpec, Project, SceneComponent, Vec3 } from './types'

export type DistanceMeasurementKind = 'component-component' | 'component-plane-edge' | 'component-ground' | 'forbidden-zone-plane-edge'

export type DistanceMeasurementEdge = 'left' | 'right' | 'bottom' | 'top'

export type DistanceMeasurement = {
  id: string
  kind: DistanceMeasurementKind
  label: string
  distanceMeters: number
  start: Vec3
  end: Vec3
  labelPosition: Vec3
  componentIds: string[]
  forbiddenZoneIds?: string[]
  targetPlaneId?: string
  edge?: DistanceMeasurementEdge
}

type MeasurementProject = Pick<Project, 'components' | 'planes'> & Partial<Pick<Project, 'forbiddenZones'>>

const SURFACE_LINE_OFFSET = 0.035
const GROUND_LINE_SIDE_OFFSET = 0.035

export function buildDistanceMeasurements(project: MeasurementProject, selectedId?: string | null): DistanceMeasurement[] {
  const footprints = project.components.map((component) => resolveComponentFootprint(component, project.planes)).filter((footprint): footprint is ComponentFootprint => Boolean(footprint))
  const selectedComponent = selectedId ? project.components.find((component) => component.id === selectedId) : undefined
  const selectedFootprint = selectedComponent ? footprints.find((footprint) => footprint.component.id === selectedComponent.id) : undefined
  const selectedZone = selectedId ? project.forbiddenZones?.find((zone) => zone.id === selectedId) : undefined

  if (selectedComponent) {
    return selectedFootprint
      ? [
          ...buildSelectedComponentPairMeasurements(selectedFootprint, footprints),
          ...buildPlaneEdgeMeasurements(selectedFootprint),
          ...compactMeasurement(buildGroundMeasurement(selectedComponent, project.planes, selectedFootprint)),
        ]
      : compactMeasurement(buildGroundMeasurement(selectedComponent, project.planes))
  }

  if (selectedZone) {
    const plane = project.planes.find((item) => item.id === selectedZone.planeId)
    return plane ? buildForbiddenZoneEdgeMeasurements(selectedZone, plane) : []
  }

  const selectedPlane = selectedId ? project.planes.find((plane) => plane.id === selectedId) : undefined
  const planeIds = selectedPlane ? [selectedPlane.id] : Array.from(new Set(footprints.map((footprint) => footprint.plane.id)))
  return planeIds.flatMap((planeId) => compactMeasurement(buildNearestPairMeasurement(footprints.filter((footprint) => footprint.plane.id === planeId))))
}

function buildSelectedComponentPairMeasurements(selected: ComponentFootprint, footprints: ComponentFootprint[]) {
  const candidates = footprints.filter((footprint) => footprint.component.id !== selected.component.id && footprint.plane.id === selected.plane.id)
  return (['left', 'right', 'bottom', 'top'] as const)
    .map((edge) => findDirectionalNeighbor(selected, candidates, edge))
    .filter((measurement): measurement is DistanceMeasurement => Boolean(measurement))
}

function findDirectionalNeighbor(selected: ComponentFootprint, candidates: ComponentFootprint[], edge: DistanceMeasurementEdge): DistanceMeasurement | null {
  let nearest: { footprint: ComponentFootprint; score: number } | null = null
  for (const footprint of candidates) {
    const score = directionalNeighborScore(selected.rect, footprint.rect, edge)
    if (score === null) continue
    if (!nearest || score < nearest.score) nearest = { footprint, score }
  }

  if (!nearest) return null
  const measurement = buildPairMeasurement(selected, nearest.footprint)
  return {
    ...measurement,
    id: `${measurement.id}-${edge}`,
    edge,
  }
}

function directionalNeighborScore(selected: Rect2, candidate: Rect2, edge: DistanceMeasurementEdge) {
  if (edge === 'left') {
    if (candidate.maxX > selected.minX) return null
    return selected.minX - candidate.maxX + axisGap(selected.minY, selected.maxY, candidate.minY, candidate.maxY)
  }
  if (edge === 'right') {
    if (candidate.minX < selected.maxX) return null
    return candidate.minX - selected.maxX + axisGap(selected.minY, selected.maxY, candidate.minY, candidate.maxY)
  }
  if (edge === 'bottom') {
    if (candidate.maxY > selected.minY) return null
    return selected.minY - candidate.maxY + axisGap(selected.minX, selected.maxX, candidate.minX, candidate.maxX)
  }
  if (candidate.minY < selected.maxY) return null
  return candidate.minY - selected.maxY + axisGap(selected.minX, selected.maxX, candidate.minX, candidate.maxX)
}

function axisGap(aMin: number, aMax: number, bMin: number, bMax: number) {
  if (aMax < bMin) return bMin - aMax
  if (bMax < aMin) return aMin - bMax
  return 0
}

function buildNearestPairMeasurement(footprints: ComponentFootprint[]) {
  if (footprints.length < 2) return null

  let nearest: DistanceMeasurement | null = null
  for (let left = 0; left < footprints.length; left += 1) {
    for (let right = left + 1; right < footprints.length; right += 1) {
      const measurement = buildPairMeasurement(footprints[left], footprints[right])
      if (!nearest || measurement.distanceMeters < nearest.distanceMeters) nearest = measurement
    }
  }

  return nearest
}

function buildPairMeasurement(a: ComponentFootprint, b: ComponentFootprint): DistanceMeasurement {
  const points = closestRectPoints(a.rect, b.rect)
  const start = surfacePoint(a, points.ax, points.ay)
  const end = surfacePoint(a, points.bx, points.by)
  const distanceMeters = roundNumber(Math.hypot(points.bx - points.ax, points.by - points.ay))
  const sortedIds = [a.component.id, b.component.id].sort()

  return {
    id: `measurement-component-component-${sortedIds[0]}-${sortedIds[1]}`,
    kind: 'component-component',
    label: `间距 ${formatDistance(distanceMeters)}`,
    distanceMeters,
    start,
    end,
    labelPosition: midpoint(start, end, scaleVec3(a.normal, 0.012)),
    componentIds: sortedIds,
    targetPlaneId: a.plane.id,
  }
}

function buildPlaneEdgeMeasurements(footprint: ComponentFootprint): DistanceMeasurement[] {
  const halfWidth = footprint.plane.width / 2
  const halfHeight = footprint.plane.height / 2
  const centerX = (footprint.rect.minX + footprint.rect.maxX) / 2
  const centerY = (footprint.rect.minY + footprint.rect.maxY) / 2
  const edges: Array<{
    edge: DistanceMeasurementEdge
    distance: number
    startLocal: { x: number; y: number }
    endLocal: { x: number; y: number }
  }> = [
    {
      edge: 'left',
      distance: footprint.rect.minX + halfWidth,
      startLocal: { x: footprint.rect.minX, y: centerY },
      endLocal: { x: -halfWidth, y: centerY },
    },
    {
      edge: 'right',
      distance: halfWidth - footprint.rect.maxX,
      startLocal: { x: footprint.rect.maxX, y: centerY },
      endLocal: { x: halfWidth, y: centerY },
    },
    {
      edge: 'bottom',
      distance: footprint.rect.minY + halfHeight,
      startLocal: { x: centerX, y: footprint.rect.minY },
      endLocal: { x: centerX, y: -halfHeight },
    },
    {
      edge: 'top',
      distance: halfHeight - footprint.rect.maxY,
      startLocal: { x: centerX, y: footprint.rect.maxY },
      endLocal: { x: centerX, y: halfHeight },
    },
  ]

  return edges.map((item) => {
    const start = surfacePoint(footprint, item.startLocal.x, item.startLocal.y)
    const end = surfacePoint(footprint, item.endLocal.x, item.endLocal.y)
    const distanceMeters = roundNumber(Math.max(0, item.distance))
    return {
      id: `measurement-edge-${footprint.component.id}-${item.edge}`,
      kind: 'component-plane-edge',
      label: `${edgeLabel(item.edge, footprint.plane.type)} ${formatDistance(distanceMeters)}`,
      distanceMeters,
      start,
      end,
      labelPosition: midpoint(start, end, scaleVec3(footprint.normal, 0.012)),
      componentIds: [footprint.component.id],
      targetPlaneId: footprint.plane.id,
      edge: item.edge,
    }
  })
}

function buildForbiddenZoneEdgeMeasurements(zone: ForbiddenZone, plane: PlaneSpec): DistanceMeasurement[] {
  const bounds = getForbiddenZoneBounds(zone)
  const halfWidth = plane.width / 2
  const halfHeight = plane.height / 2
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const normal = planeSurfaceNormal(plane)
  const edges: Array<{
    edge: DistanceMeasurementEdge
    distance: number
    startLocal: { x: number; y: number }
    endLocal: { x: number; y: number }
  }> = [
    {
      edge: 'left',
      distance: bounds.minX + halfWidth,
      startLocal: { x: bounds.minX, y: centerY },
      endLocal: { x: -halfWidth, y: centerY },
    },
    {
      edge: 'right',
      distance: halfWidth - bounds.maxX,
      startLocal: { x: bounds.maxX, y: centerY },
      endLocal: { x: halfWidth, y: centerY },
    },
    {
      edge: 'bottom',
      distance: bounds.minY + halfHeight,
      startLocal: { x: centerX, y: bounds.minY },
      endLocal: { x: centerX, y: -halfHeight },
    },
    {
      edge: 'top',
      distance: halfHeight - bounds.maxY,
      startLocal: { x: centerX, y: bounds.maxY },
      endLocal: { x: centerX, y: halfHeight },
    },
  ]

  return edges.map((item) => {
    const start = planeSurfacePoint(plane, item.startLocal.x, item.startLocal.y, forbiddenZoneSurfaceLocalZ(plane), normal)
    const end = planeSurfacePoint(plane, item.endLocal.x, item.endLocal.y, forbiddenZoneSurfaceLocalZ(plane), normal)
    const distanceMeters = roundNumber(Math.max(0, item.distance))
    return {
      id: `measurement-zone-edge-${zone.id}-${item.edge}`,
      kind: 'forbidden-zone-plane-edge',
      label: `${edgeLabel(item.edge, plane.type)} ${formatDistance(distanceMeters)}`,
      distanceMeters,
      start,
      end,
      labelPosition: midpoint(start, end, scaleVec3(normal, 0.012)),
      componentIds: [],
      forbiddenZoneIds: [zone.id],
      targetPlaneId: plane.id,
      edge: item.edge,
    }
  })
}

function buildGroundMeasurement(component: SceneComponent, planes: PlaneSpec[], footprint?: ComponentFootprint): DistanceMeasurement | null {
  const size = component.size ?? getComponentCatalogItem(component.kind)?.defaultSize ?? { x: 0.46, y: 0.28, z: 0.14 }
  const groundY = resolveGroundY(planes)
  const bottomPoint = footprint?.mode === 'wall' ? surfacePoint(footprint, (footprint.rect.minX + footprint.rect.maxX) / 2, footprint.rect.minY) : roundVec3({ x: component.position.x, y: component.position.y - size.y / 2, z: component.position.z })
  const distanceMeters = roundNumber(Math.max(0, bottomPoint.y - groundY))
  if (distanceMeters <= 0.001) return null

  const end = roundVec3({ x: bottomPoint.x, y: groundY, z: bottomPoint.z })
  const labelOffset = { x: GROUND_LINE_SIDE_OFFSET, y: 0, z: GROUND_LINE_SIDE_OFFSET }

  return {
    id: `measurement-ground-${component.id}`,
    kind: 'component-ground',
    label: `离地 ${formatDistance(distanceMeters)}`,
    distanceMeters,
    start: bottomPoint,
    end,
    labelPosition: midpoint(bottomPoint, end, labelOffset),
    componentIds: [component.id],
  }
}

function resolveGroundY(planes: PlaneSpec[]) {
  const floor = planes.find((plane) => plane.type === 'floor')
  if (!floor) return 0
  return planeLocalToWorld({ x: 0, y: 0, z: FLOOR_THICKNESS / 2 }, floor).y
}

function surfacePoint(footprint: ComponentFootprint, x: number, y: number): Vec3 {
  return planeSurfacePoint(footprint.plane, x, y, footprint.anchorLocal.z, footprint.normal)
}

function planeSurfacePoint(plane: PlaneSpec, x: number, y: number, z: number, normal = planeSurfaceNormal(plane)): Vec3 {
  return roundVec3(addVec3(planeLocalToWorld({ x, y, z }, plane), scaleVec3(normal, SURFACE_LINE_OFFSET)))
}

function forbiddenZoneSurfaceLocalZ(plane: PlaneSpec) {
  return plane.type === 'floor' ? FLOOR_THICKNESS / 2 : WALL_THICKNESS / 2
}

function closestRectPoints(a: Rect2, b: Rect2) {
  const x = closestAxisPoints(a.minX, a.maxX, b.minX, b.maxX)
  const y = closestAxisPoints(a.minY, a.maxY, b.minY, b.maxY)
  return {
    ax: x.a,
    ay: y.a,
    bx: x.b,
    by: y.b,
  }
}

function closestAxisPoints(aMin: number, aMax: number, bMin: number, bMax: number) {
  if (aMax < bMin) return { a: aMax, b: bMin }
  if (bMax < aMin) return { a: aMin, b: bMax }

  const overlapMin = Math.max(aMin, bMin)
  const overlapMax = Math.min(aMax, bMax)
  const overlapCenter = (overlapMin + overlapMax) / 2
  return { a: overlapCenter, b: overlapCenter }
}

function midpoint(start: Vec3, end: Vec3, offset: Vec3): Vec3 {
  return roundVec3(addVec3({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, z: (start.z + end.z) / 2 }, offset))
}

function edgeLabel(edge: DistanceMeasurementEdge, planeType: PlaneSpec['type']) {
  if (edge === 'left') return '左边'
  if (edge === 'right') return '右边'
  if (edge === 'bottom') return planeType === 'wall' ? '下边' : '近边'
  return planeType === 'wall' ? '上边' : '远边'
}

export function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1) return `${Math.round(distanceMeters * 100)} cm`
  return `${distanceMeters.toFixed(2)} m`
}

function compactMeasurement(measurement: DistanceMeasurement | null) {
  return measurement ? [measurement] : []
}
