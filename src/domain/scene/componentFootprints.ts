import { getComponentCatalogItem } from './componentCatalog'
import { planeSurfaceNormal, roundNumber, scaleVec3, subtractVec3, worldToPlaneLocal } from './planeMath'
import type { ComponentPlacementMode, PlaneSpec, SceneComponent, Vec2, Vec3 } from './types'

export type Rect2 = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type ComponentFootprint = {
  component: SceneComponent
  plane: PlaneSpec
  mode: Exclude<ComponentPlacementMode, 'free'>
  size: Vec3
  normal: Vec3
  anchorLocal: Vec3
  rect: Rect2
}

export type DrawingRect2 = Rect2 & {
  center: Vec2
}

const FALLBACK_COMPONENT_SIZE: Vec3 = { x: 0.46, y: 0.28, z: 0.14 }

export function resolveComponentFootprint(component: SceneComponent, planes: PlaneSpec[]): ComponentFootprint | null {
  const mode = component.placement?.mode
  if (mode !== 'wall' && mode !== 'floor') return null

  const targetPlaneId = component.placement?.targetPlaneId ?? component.targetPlaneId
  const plane = planes.find((item) => item.id === targetPlaneId && item.type === mode)
  if (!plane) return null

  const size = component.size ?? getComponentCatalogItem(component.kind)?.defaultSize ?? FALLBACK_COMPONENT_SIZE
  const normal = planeSurfaceNormal(plane)
  const offset = mode === 'wall' ? size.z / 2 : size.y / 2
  const anchor = component.placement?.anchor ?? subtractVec3(component.position, scaleVec3(normal, offset))
  const anchorLocal = worldToPlaneLocal(anchor, plane)
  const footprintYExtent = mode === 'wall' ? size.y / 2 : size.z / 2

  return {
    component,
    plane,
    mode,
    size,
    normal,
    anchorLocal,
    rect: {
      minX: roundNumber(anchorLocal.x - size.x / 2),
      maxX: roundNumber(anchorLocal.x + size.x / 2),
      minY: roundNumber(anchorLocal.y - footprintYExtent),
      maxY: roundNumber(anchorLocal.y + footprintYExtent),
    },
  }
}

export function rectToDrawingCoordinates(rect: Rect2, plane: PlaneSpec): DrawingRect2 {
  const drawingRect = {
    minX: roundNumber(rect.minX + plane.width / 2),
    maxX: roundNumber(rect.maxX + plane.width / 2),
    minY: roundNumber(rect.minY + plane.height / 2),
    maxY: roundNumber(rect.maxY + plane.height / 2),
  }
  return {
    ...drawingRect,
    center: {
      x: roundNumber((drawingRect.minX + drawingRect.maxX) / 2),
      y: roundNumber((drawingRect.minY + drawingRect.maxY) / 2),
    },
  }
}

export function rectExceedsPlane(rect: Rect2, plane: PlaneSpec) {
  return rect.minX < -plane.width / 2 || rect.maxX > plane.width / 2 || rect.minY < -plane.height / 2 || rect.maxY > plane.height / 2
}
