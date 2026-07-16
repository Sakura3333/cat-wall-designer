import { resolveComponentFootprint, type Rect2 } from './componentFootprints'
import { roundNumber } from './planeMath'
import type { ForbiddenZone, ForbiddenZoneShape, PlaneSpec, SceneComponent, Vec2 } from './types'

export type { Rect2 } from './componentFootprints'

export type ForbiddenZoneDraftInput = {
  id: string
  name: string
  planeId: string
  shape: ForbiddenZoneShape
  start: Vec2
  end: Vec2
}

const MIN_ZONE_SIZE = 0.08
const DEFAULT_ANCHOR_OFFSET = 0.12

export function buildForbiddenZoneFromDrag(input: ForbiddenZoneDraftInput): ForbiddenZone {
  const rect = dragRect(input.start, input.end)
  if (input.shape === 'ellipse') {
    return {
      id: input.id,
      name: input.name,
      planeId: input.planeId,
      shape: 'ellipse',
      center: roundVec2({
        x: (rect.minX + rect.maxX) / 2,
        y: (rect.minY + rect.maxY) / 2,
      }),
      radiusX: roundPositive((rect.maxX - rect.minX) / 2),
      radiusY: roundPositive((rect.maxY - rect.minY) / 2),
    }
  }

  return {
    id: input.id,
    name: input.name,
    planeId: input.planeId,
    shape: 'polygon',
    points: [
      { x: rect.minX, y: rect.minY },
      { x: rect.maxX, y: rect.minY },
      { x: rect.maxX, y: rect.maxY },
      { x: rect.minX, y: rect.maxY },
    ].map(roundVec2),
  }
}

export function normalizeForbiddenZone(value: unknown): ForbiddenZone | null {
  if (!value || typeof value !== 'object') return null
  const zone = value as Partial<ForbiddenZone>
  if (typeof zone.id !== 'string' || typeof zone.planeId !== 'string') return null
  if (zone.shape === 'ellipse') {
    const center = normalizeVec2(zone.center)
    const radiusX = normalizePositiveNumber(zone.radiusX)
    const radiusY = normalizePositiveNumber(zone.radiusY)
    if (!center || radiusX === null || radiusY === null) return null
    return {
      id: zone.id,
      name: typeof zone.name === 'string' && zone.name.trim() ? zone.name : '禁止区域',
      planeId: zone.planeId,
      shape: 'ellipse',
      center,
      radiusX,
      radiusY,
    }
  }

  if (zone.shape === 'polygon') {
    const points = Array.isArray(zone.points) ? zone.points.map(normalizeVec2).filter((point): point is Vec2 => Boolean(point)) : []
    if (points.length < 3) return null
    return {
      id: zone.id,
      name: typeof zone.name === 'string' && zone.name.trim() ? zone.name : '禁止区域',
      planeId: zone.planeId,
      shape: 'polygon',
      points,
    }
  }

  return null
}

export function filterForbiddenZonesForPlanes(zones: ForbiddenZone[], planes: PlaneSpec[]) {
  const planeIds = new Set(planes.map((plane) => plane.id))
  return zones.filter((zone) => planeIds.has(zone.planeId))
}

export function getForbiddenZoneCenter(zone: ForbiddenZone): Vec2 {
  if (zone.shape === 'ellipse') return roundVec2(zone.center ?? { x: 0, y: 0 })
  const bounds = getForbiddenZoneBounds(zone)
  return roundVec2({
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  })
}

export function getForbiddenZoneSize(zone: ForbiddenZone): Vec2 {
  if (zone.shape === 'ellipse') {
    return {
      x: roundPositive((zone.radiusX ?? MIN_ZONE_SIZE / 2) * 2),
      y: roundPositive((zone.radiusY ?? MIN_ZONE_SIZE / 2) * 2),
    }
  }

  const bounds = getForbiddenZoneBounds(zone)
  return {
    x: roundPositive(bounds.maxX - bounds.minX),
    y: roundPositive(bounds.maxY - bounds.minY),
  }
}

export function moveForbiddenZoneToCenter(zone: ForbiddenZone, center: Vec2): ForbiddenZone {
  const current = getForbiddenZoneCenter(zone)
  return moveForbiddenZoneBy(zone, {
    x: center.x - current.x,
    y: center.y - current.y,
  })
}

export function moveForbiddenZoneBy(zone: ForbiddenZone, delta: Vec2): ForbiddenZone {
  if (zone.shape === 'ellipse') {
    return {
      ...zone,
      center: roundVec2({
        x: (zone.center?.x ?? 0) + delta.x,
        y: (zone.center?.y ?? 0) + delta.y,
      }),
    }
  }

  return {
    ...zone,
    points: (zone.points ?? []).map((point) => roundVec2({ x: point.x + delta.x, y: point.y + delta.y })),
  }
}

export function resizeForbiddenZone(zone: ForbiddenZone, size: Vec2): ForbiddenZone {
  const width = Math.max(MIN_ZONE_SIZE, size.x)
  const height = Math.max(MIN_ZONE_SIZE, size.y)
  if (zone.shape === 'ellipse') {
    return {
      ...zone,
      radiusX: roundPositive(width / 2),
      radiusY: roundPositive(height / 2),
    }
  }

  const center = getForbiddenZoneCenter(zone)
  const currentSize = getForbiddenZoneSize(zone)
  const scaleX = currentSize.x <= 0.0001 ? 1 : width / currentSize.x
  const scaleY = currentSize.y <= 0.0001 ? 1 : height / currentSize.y
  return {
    ...zone,
    points: (zone.points ?? []).map((point) =>
      roundVec2({
        x: center.x + (point.x - center.x) * scaleX,
        y: center.y + (point.y - center.y) * scaleY,
      }),
    ),
  }
}

export function addForbiddenZoneAnchor(zone: ForbiddenZone): ForbiddenZone {
  if (zone.shape !== 'polygon') return zone
  const points = zone.points ?? []
  if (points.length < 2) {
    const center = getForbiddenZoneCenter(zone)
    return {
      ...zone,
      points: [
        { x: center.x - DEFAULT_ANCHOR_OFFSET, y: center.y - DEFAULT_ANCHOR_OFFSET },
        { x: center.x + DEFAULT_ANCHOR_OFFSET, y: center.y - DEFAULT_ANCHOR_OFFSET },
        { x: center.x, y: center.y + DEFAULT_ANCHOR_OFFSET },
      ].map(roundVec2),
    }
  }

  let longestEdgeIndex = 0
  let longestEdgeLength = -1
  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length
    const length = distance2(points[index], points[nextIndex])
    if (length > longestEdgeLength) {
      longestEdgeLength = length
      longestEdgeIndex = index
    }
  }

  const nextIndex = (longestEdgeIndex + 1) % points.length
  const anchor = roundVec2({
    x: (points[longestEdgeIndex].x + points[nextIndex].x) / 2,
    y: (points[longestEdgeIndex].y + points[nextIndex].y) / 2,
  })
  const nextPoints = [...points]
  nextPoints.splice(nextIndex, 0, anchor)
  return { ...zone, points: nextPoints }
}

export function removeForbiddenZoneAnchor(zone: ForbiddenZone, index: number): ForbiddenZone {
  if (zone.shape !== 'polygon') return zone
  const points = zone.points ?? []
  if (points.length <= 3 || index < 0 || index >= points.length) return zone
  return {
    ...zone,
    points: points.filter((_, pointIndex) => pointIndex !== index),
  }
}

export function updateForbiddenZoneAnchor(zone: ForbiddenZone, index: number, point: Vec2): ForbiddenZone {
  if (zone.shape !== 'polygon') return zone
  const points = zone.points ?? []
  if (index < 0 || index >= points.length) return zone
  return {
    ...zone,
    points: points.map((item, pointIndex) => (pointIndex === index ? roundVec2(point) : item)),
  }
}

export function findBlockingForbiddenZone(component: SceneComponent, planes: PlaneSpec[], zones: ForbiddenZone[]): ForbiddenZone | null {
  const footprint = resolveComponentFootprint(component, planes)
  if (!footprint) return null

  return zones.find((zone) => zone.planeId === footprint.plane.id && forbiddenZoneIntersectsRect(zone, footprint.rect)) ?? null
}

export function findBlockingComponentForForbiddenZone(zone: ForbiddenZone, components: SceneComponent[], planes: PlaneSpec[]): SceneComponent | null {
  return (
    components.find((component) => {
      const footprint = resolveComponentFootprint(component, planes)
      return footprint?.plane.id === zone.planeId && forbiddenZoneIntersectsRect(zone, footprint.rect)
    }) ?? null
  )
}

export function forbiddenZoneIntersectsRect(zone: ForbiddenZone, rect: Rect2): boolean {
  if (zone.shape === 'ellipse') return ellipseIntersectsRect(zone, rect)
  return polygonIntersectsRect(zone.points ?? [], rect)
}

export function getForbiddenZoneBounds(zone: ForbiddenZone): Rect2 {
  if (zone.shape === 'ellipse') {
    const center = zone.center ?? { x: 0, y: 0 }
    const radiusX = zone.radiusX ?? MIN_ZONE_SIZE / 2
    const radiusY = zone.radiusY ?? MIN_ZONE_SIZE / 2
    return {
      minX: roundNumber(center.x - radiusX),
      maxX: roundNumber(center.x + radiusX),
      minY: roundNumber(center.y - radiusY),
      maxY: roundNumber(center.y + radiusY),
    }
  }

  const points = zone.points ?? []
  if (points.length === 0) return { minX: 0, maxX: MIN_ZONE_SIZE, minY: 0, maxY: MIN_ZONE_SIZE }
  return {
    minX: roundNumber(Math.min(...points.map((point) => point.x))),
    maxX: roundNumber(Math.max(...points.map((point) => point.x))),
    minY: roundNumber(Math.min(...points.map((point) => point.y))),
    maxY: roundNumber(Math.max(...points.map((point) => point.y))),
  }
}

function polygonIntersectsRect(points: Vec2[], rect: Rect2) {
  if (points.length < 3) return false
  const rectPoints = rectCorners(rect)
  if (points.some((point) => pointInRect(point, rect))) return true
  if (rectPoints.some((point) => pointInPolygon(point, points))) return true

  const polygonEdges = points.map((point, index) => [point, points[(index + 1) % points.length]] as const)
  const rectEdges = rectPoints.map((point, index) => [point, rectPoints[(index + 1) % rectPoints.length]] as const)
  return polygonEdges.some(([a, b]) => rectEdges.some(([c, d]) => segmentsIntersect(a, b, c, d)))
}

function ellipseIntersectsRect(zone: ForbiddenZone, rect: Rect2) {
  const center = zone.center ?? { x: 0, y: 0 }
  const radiusX = Math.max(MIN_ZONE_SIZE / 2, zone.radiusX ?? MIN_ZONE_SIZE / 2)
  const radiusY = Math.max(MIN_ZONE_SIZE / 2, zone.radiusY ?? MIN_ZONE_SIZE / 2)
  const closestX = clamp(center.x, rect.minX, rect.maxX)
  const closestY = clamp(center.y, rect.minY, rect.maxY)
  const normalizedX = (closestX - center.x) / radiusX
  const normalizedY = (closestY - center.y) / radiusY
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1
}

function pointInRect(point: Vec2, rect: Rect2) {
  return point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY
}

function rectCorners(rect: Rect2): Vec2[] {
  return [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ]
}

function pointInPolygon(point: Vec2, polygon: Vec2[]) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index]
    const b = polygon[previous]
    const crosses = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)

  if (abC === 0 && pointOnSegment(c, a, b)) return true
  if (abD === 0 && pointOnSegment(d, a, b)) return true
  if (cdA === 0 && pointOnSegment(a, c, d)) return true
  if (cdB === 0 && pointOnSegment(b, c, d)) return true
  return abC !== abD && cdA !== cdB
}

function orientation(a: Vec2, b: Vec2, c: Vec2) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
  if (Math.abs(value) < 0.000001) return 0
  return value > 0 ? 1 : 2
}

function pointOnSegment(point: Vec2, a: Vec2, b: Vec2) {
  return point.x <= Math.max(a.x, b.x) && point.x >= Math.min(a.x, b.x) && point.y <= Math.max(a.y, b.y) && point.y >= Math.min(a.y, b.y)
}

function dragRect(start: Vec2, end: Vec2): Rect2 {
  const width = Math.max(MIN_ZONE_SIZE, Math.abs(end.x - start.x))
  const height = Math.max(MIN_ZONE_SIZE, Math.abs(end.y - start.y))
  const signX = end.x >= start.x ? 1 : -1
  const signY = end.y >= start.y ? 1 : -1
  const safeEnd = {
    x: start.x + width * signX,
    y: start.y + height * signY,
  }
  return {
    minX: roundNumber(Math.min(start.x, safeEnd.x)),
    maxX: roundNumber(Math.max(start.x, safeEnd.x)),
    minY: roundNumber(Math.min(start.y, safeEnd.y)),
    maxY: roundNumber(Math.max(start.y, safeEnd.y)),
  }
}

function normalizeVec2(value: unknown): Vec2 | null {
  if (!value || typeof value !== 'object') return null
  const point = value as Partial<Vec2>
  if (typeof point.x !== 'number' || typeof point.y !== 'number' || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  return roundVec2({ x: point.x, y: point.y })
}

function normalizePositiveNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return roundPositive(value)
}

function roundVec2(point: Vec2): Vec2 {
  return {
    x: roundNumber(point.x),
    y: roundNumber(point.y),
  }
}

function roundPositive(value: number) {
  return roundNumber(Math.max(MIN_ZONE_SIZE / 2, value))
}

function distance2(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
