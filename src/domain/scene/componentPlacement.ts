import type { ComponentCatalogItem } from './componentCatalog'
import type { ComponentPlacement, ComponentPlacementHit, ComponentPlacementMode, PlaneSpec, SceneComponent, Vec3 } from './types'

export type ComponentPlacementSpec = Pick<ComponentCatalogItem, 'placement' | 'defaultSize' | 'defaultRotation'>

export type ComponentPlacementWarning = 'component-width-exceeds-plane' | 'component-height-exceeds-plane' | 'component-depth-exceeds-plane'

export type ComponentPlacementResult =
  | {
      canPlace: true
      placement: ComponentPlacement
      position: Vec3
      rotation: Vec3
      warnings: ComponentPlacementWarning[]
    }
  | {
      canPlace: false
      reason: string
      warnings: ComponentPlacementWarning[]
    }

export type ComponentPlacementClampResult = {
  anchor: Vec3
  warnings: ComponentPlacementWarning[]
}

const FREE_DROP_OFFSET = 0.08

export function canPlaceOnHit(mode: ComponentPlacementMode, hit: ComponentPlacementHit): boolean {
  if (mode === 'free') return true
  if (hit.planeType !== mode) return false
  if (mode === 'wall') return hit.surface === undefined || hit.surface === 'front' || hit.surface === 'back'
  return hit.surface === undefined || hit.surface === 'top'
}

export function buildComponentPlacement(spec: ComponentPlacementSpec, hit: ComponentPlacementHit | null, planes: PlaneSpec[]): ComponentPlacementResult {
  if (!hit) return { canPlace: false, reason: 'missing-hit', warnings: [] }
  if (!canPlaceOnHit(spec.placement, hit)) return { canPlace: false, reason: 'incompatible-surface', warnings: [] }

  if (spec.placement === 'free') {
    const normal = normalize(hit.normal, { x: 0, y: 1, z: 0 })
    return {
      canPlace: true,
      placement: {
        mode: 'free',
        anchor: hit.point,
        normal,
      },
      position: roundVec3(add(hit.point, scale(normal, FREE_DROP_OFFSET))),
      rotation: spec.defaultRotation,
      warnings: [],
    }
  }

  const plane = planes.find((item) => item.id === hit.planeId && item.type === spec.placement)
  if (!plane) return { canPlace: false, reason: 'missing-plane', warnings: [] }

  const normal = planeSurfaceNormal(plane)
  const clampResult = clampAnchorToPlaneBoundsWithWarnings(hit.point, plane, spec.defaultSize, spec.placement)
  const offset = spec.placement === 'wall' ? spec.defaultSize.z / 2 : spec.defaultSize.y / 2

  return {
    canPlace: true,
    placement: {
      mode: spec.placement,
      targetPlaneId: plane.id,
      anchor: clampResult.anchor,
      normal,
    },
    position: roundVec3(add(clampResult.anchor, scale(normal, offset))),
    rotation: placementRotation(plane, spec),
    warnings: clampResult.warnings,
  }
}

export function clampAnchorToPlaneBounds(anchor: Vec3, plane: PlaneSpec, componentSize: Vec3, mode: ComponentPlacementMode): Vec3 {
  return clampAnchorToPlaneBoundsWithWarnings(anchor, plane, componentSize, mode).anchor
}

export function constrainComponentTransform(
  component: SceneComponent,
  patch: Partial<SceneComponent>,
  planes: PlaneSpec[],
  spec?: Partial<ComponentPlacementSpec>,
): Partial<SceneComponent> {
  const mode = component.placement?.mode
  if (!mode || mode === 'free' || !component.placement?.targetPlaneId) return patch

  const plane = planes.find((item) => item.id === component.placement?.targetPlaneId && item.type === mode)
  if (!plane) return patch

  const size = patch.size ?? component.size ?? spec?.defaultSize ?? { x: 0.46, y: 0.28, z: 0.14 }
  const normal = component.placement.normal ?? planeSurfaceNormal(plane)
  const offset = mode === 'wall' ? size.z / 2 : size.y / 2
  const sourcePosition = patch.position ?? component.position
  const inferredAnchor = patch.position ? subtract(sourcePosition, scale(normal, offset)) : component.placement.anchor ?? subtract(sourcePosition, scale(normal, offset))
  const anchor = clampAnchorToPlaneBounds(inferredAnchor, plane, size, mode)

  return {
    ...patch,
    position: roundVec3(add(anchor, scale(normal, offset))),
    placement: {
      ...component.placement,
      mode,
      targetPlaneId: plane.id,
      anchor,
      normal,
    },
  }
}

export function clampAnchorToPlaneBoundsWithWarnings(anchor: Vec3, plane: PlaneSpec, componentSize: Vec3, mode: ComponentPlacementMode): ComponentPlacementClampResult {
  if (mode === 'free') return { anchor, warnings: [] }

  const local = worldToPlaneLocal(anchor, plane)
  const warnings: ComponentPlacementWarning[] = []

  if (mode === 'wall') {
    const x = clampOnPlaneAxis(local.x, plane.width, componentSize.x, warnings, 'width')
    const y = clampOnPlaneAxis(local.y, plane.height, componentSize.y, warnings, 'height')
    return { anchor: roundVec3(planeLocalToWorld({ ...local, x, y }, plane)), warnings }
  }

  const x = clampOnPlaneAxis(local.x, plane.width, componentSize.x, warnings, 'width')
  const y = clampOnPlaneAxis(local.y, plane.height, componentSize.z, warnings, 'depth')
  return { anchor: roundVec3(planeLocalToWorld({ ...local, x, y }, plane)), warnings }
}

function clampOnPlaneAxis(value: number, planeExtent: number, componentExtent: number, warnings: ComponentPlacementWarning[], axis: 'width' | 'height' | 'depth') {
  const min = -planeExtent / 2 + componentExtent / 2
  const max = planeExtent / 2 - componentExtent / 2
  if (min > max) {
    warnings.push(`component-${axis}-exceeds-plane`)
    return 0
  }
  return Math.min(max, Math.max(min, value))
}

function placementRotation(plane: PlaneSpec, spec: ComponentPlacementSpec): Vec3 {
  if (spec.placement === 'wall') {
    return roundVec3({
      x: plane.rotation.x + spec.defaultRotation.x,
      y: plane.rotation.y + spec.defaultRotation.y,
      z: plane.rotation.z + spec.defaultRotation.z,
    })
  }

  return spec.defaultRotation
}

function planeSurfaceNormal(plane: PlaneSpec): Vec3 {
  return roundVec3(normalize(rotateVec3({ x: 0, y: 0, z: 1 }, plane.rotation), { x: 0, y: 1, z: 0 }))
}

function worldToPlaneLocal(point: Vec3, plane: PlaneSpec): Vec3 {
  return inverseRotateVec3(subtract(point, plane.position), plane.rotation)
}

function planeLocalToWorld(point: Vec3, plane: PlaneSpec): Vec3 {
  return add(plane.position, rotateVec3(point, plane.rotation))
}

function rotateVec3(vector: Vec3, rotation: Vec3): Vec3 {
  return rotateZ(rotateY(rotateX(vector, rotation.x), rotation.y), rotation.z)
}

function inverseRotateVec3(vector: Vec3, rotation: Vec3): Vec3 {
  return rotateX(rotateY(rotateZ(vector, -rotation.z), -rotation.y), -rotation.x)
}

function rotateX(vector: Vec3, angle: number): Vec3 {
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return {
    x: vector.x,
    y: vector.y * cos - vector.z * sin,
    z: vector.y * sin + vector.z * cos,
  }
}

function rotateY(vector: Vec3, angle: number): Vec3 {
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return {
    x: vector.x * cos + vector.z * sin,
    y: vector.y,
    z: -vector.x * sin + vector.z * cos,
  }
}

function rotateZ(vector: Vec3, angle: number): Vec3 {
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
    z: vector.z,
  }
}

function normalize(vector: Vec3, fallback: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length <= 0.000001) return fallback
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  }
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function scale(vector: Vec3, value: number): Vec3 {
  return { x: vector.x * value, y: vector.y * value, z: vector.z * value }
}

function roundVec3(vector: Vec3): Vec3 {
  return {
    x: roundNumber(vector.x),
    y: roundNumber(vector.y),
    z: roundNumber(vector.z),
  }
}

function roundNumber(value: number) {
  const rounded = Number(value.toFixed(6))
  return Object.is(rounded, -0) ? 0 : rounded
}
