import type { ComponentCatalogItem } from './componentCatalog'
import type { ComponentPlacement, ComponentPlacementHit, ComponentPlacementMode, ComponentPlacementWarning, PlaneSpec, SceneComponent, Vec3 } from './types'
import { WALL_SURFACE_LOCAL_Z } from '../geometry/planeGeometryConstants'
import { addVec3, distanceVec3, normalizeVec3, planeLocalToWorld, planeSurfaceNormal, roundVec3, scaleVec3, subtractVec3, worldToPlaneLocal } from './planeMath'

export type ComponentPlacementSpec = Pick<ComponentCatalogItem, 'placement' | 'defaultSize' | 'defaultRotation'>

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

type TransformAttachment = {
  plane: PlaneSpec
  anchor: Vec3
  normal: Vec3
  position: Vec3
  targetChanged: boolean
  score: number
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
    const normal = normalizeVec3(hit.normal, { x: 0, y: 1, z: 0 })
    return {
      canPlace: true,
      placement: {
        mode: 'free',
        anchor: hit.point,
        normal,
      },
      position: roundVec3(addVec3(hit.point, scaleVec3(normal, FREE_DROP_OFFSET))),
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
    position: roundVec3(addVec3(clampResult.anchor, scaleVec3(normal, offset))),
    rotation: placementRotation(plane, spec),
    warnings: clampResult.warnings,
  }
}

export function clampAnchorToPlaneBounds(anchor: Vec3, plane: PlaneSpec, componentSize: Vec3, mode: ComponentPlacementMode, surfaceAnchor?: Vec3): Vec3 {
  return clampAnchorToPlaneBoundsWithWarnings(anchor, plane, componentSize, mode, surfaceAnchor).anchor
}

export function constrainComponentTransform(
  component: SceneComponent,
  patch: Partial<SceneComponent>,
  planes: PlaneSpec[],
  spec?: Partial<ComponentPlacementSpec>,
): Partial<SceneComponent> {
  const mode = component.placement?.mode
  if (!mode || mode === 'free' || !component.placement?.targetPlaneId) return patch

  const currentPlane = planes.find((item) => item.id === component.placement?.targetPlaneId && item.type === mode)
  if (!currentPlane) return patch

  const size = patch.size ?? component.size ?? spec?.defaultSize ?? { x: 0.46, y: 0.28, z: 0.14 }
  const sourcePosition = patch.position ?? component.position
  const attachment =
    mode === 'wall' && patch.position
      ? resolveWallTransformAttachment(component, sourcePosition, size, currentPlane, planes)
      : buildTransformAttachment(currentPlane, mode, sourcePosition, size, component.placement.anchor, false)
  const rotation = attachment.targetChanged
    ? placementRotation(attachment.plane, {
        placement: mode,
        defaultSize: size,
        defaultRotation: spec?.defaultRotation ?? { x: 0, y: 0, z: 0 },
      })
    : patch.rotation

  return {
    ...patch,
    targetPlaneId: attachment.plane.id,
    position: attachment.position,
    ...(rotation ? { rotation } : {}),
    placement: {
      ...component.placement,
      mode,
      targetPlaneId: attachment.plane.id,
      anchor: attachment.anchor,
      normal: attachment.normal,
    },
  }
}

export function transformBoundComponentWithPlane(
  component: SceneComponent,
  previousPlane: PlaneSpec,
  nextPlane: PlaneSpec,
  spec?: Partial<ComponentPlacementSpec>,
): SceneComponent {
  const mode = component.placement?.mode
  if (!mode || mode === 'free' || component.placement?.targetPlaneId !== previousPlane.id || previousPlane.type !== mode || nextPlane.type !== mode) {
    return component
  }

  const size = component.size ?? spec?.defaultSize ?? { x: 0.46, y: 0.28, z: 0.14 }
  const offset = mode === 'wall' ? size.z / 2 : size.y / 2
  const previousNormal = planeSurfaceNormal(previousPlane)
  const previousAnchor = component.placement.anchor ?? subtractVec3(component.position, scaleVec3(previousNormal, offset))
  const localAnchor = wallSurfaceLocal(worldToPlaneLocal(previousAnchor, previousPlane), mode)
  const nextAnchor = roundVec3(planeLocalToWorld(localAnchor, nextPlane))
  const nextNormal = planeSurfaceNormal(nextPlane)
  const localRotation = subtractVec3(component.rotation, previousPlane.rotation)
  const nextRotation = mode === 'wall' ? roundVec3(addVec3(nextPlane.rotation, localRotation)) : component.rotation

  return {
    ...component,
    targetPlaneId: nextPlane.id,
    position: roundVec3(addVec3(nextAnchor, scaleVec3(nextNormal, offset))),
    rotation: nextRotation,
    placement: {
      ...component.placement,
      mode,
      targetPlaneId: nextPlane.id,
      anchor: nextAnchor,
      normal: nextNormal,
    },
  }
}

export function projectBoundComponentOntoPlane(component: SceneComponent, plane: PlaneSpec, spec?: Partial<ComponentPlacementSpec>): SceneComponent {
  const mode = component.placement?.mode
  if (!mode || mode === 'free' || component.placement?.targetPlaneId !== plane.id || plane.type !== mode) return component

  const size = component.size ?? spec?.defaultSize ?? { x: 0.46, y: 0.28, z: 0.14 }
  const normal = planeSurfaceNormal(plane)
  const offset = mode === 'wall' ? size.z / 2 : size.y / 2
  const inferredAnchor = subtractVec3(component.position, scaleVec3(normal, offset))
  const local = wallSurfaceLocal(worldToPlaneLocal(inferredAnchor, plane), mode)
  const anchor = clampAnchorToPlaneBounds(planeLocalToWorld(local, plane), plane, size, mode)

  return {
    ...component,
    targetPlaneId: plane.id,
    position: roundVec3(addVec3(anchor, scaleVec3(normal, offset))),
    placement: {
      ...component.placement,
      mode,
      targetPlaneId: plane.id,
      anchor,
      normal,
    },
  }
}

function resolveWallTransformAttachment(component: SceneComponent, sourcePosition: Vec3, size: Vec3, currentPlane: PlaneSpec, planes: PlaneSpec[]): TransformAttachment {
  const surfaceLocalZ = component.placement?.anchor ? worldToPlaneLocal(component.placement.anchor, currentPlane).z : undefined
  const wallPlanes = planes.filter((plane) => plane.type === 'wall')

  return wallPlanes.reduce<TransformAttachment | null>((best, plane) => {
    const surfaceAnchor = surfaceLocalZ === undefined ? undefined : planeLocalToWorld({ x: 0, y: 0, z: surfaceLocalZ }, plane)
    const attachment = buildTransformAttachment(plane, 'wall', sourcePosition, size, surfaceAnchor, plane.id !== currentPlane.id)
    if (!best || attachment.score < best.score) return attachment
    return best
  }, null) ?? buildTransformAttachment(currentPlane, 'wall', sourcePosition, size, component.placement?.anchor, false)
}

function buildTransformAttachment(
  plane: PlaneSpec,
  mode: Exclude<ComponentPlacementMode, 'free'>,
  sourcePosition: Vec3,
  size: Vec3,
  surfaceAnchor: Vec3 | undefined,
  targetChanged: boolean,
): TransformAttachment {
  const normal = planeSurfaceNormal(plane)
  const offset = mode === 'wall' ? size.z / 2 : size.y / 2
  const inferredAnchor = subtractVec3(sourcePosition, scaleVec3(normal, offset))
  const anchor = clampAnchorToPlaneBounds(inferredAnchor, plane, size, mode, surfaceAnchor)
  const position = roundVec3(addVec3(anchor, scaleVec3(normal, offset)))

  return {
    plane,
    anchor,
    normal,
    position,
    targetChanged,
    score: distanceVec3(sourcePosition, position),
  }
}

export function clampAnchorToPlaneBoundsWithWarnings(anchor: Vec3, plane: PlaneSpec, componentSize: Vec3, mode: ComponentPlacementMode, surfaceAnchor?: Vec3): ComponentPlacementClampResult {
  if (mode === 'free') return { anchor, warnings: [] }

  const local = normalizePlaneSurfaceLocal(worldToPlaneLocal(anchor, plane), surfaceAnchor, plane)
  const warnings: ComponentPlacementWarning[] = []

  if (mode === 'wall') {
    const surfaceLocal = wallSurfaceLocal(local, mode)
    const x = clampOnPlaneAxis(surfaceLocal.x, plane.width, componentSize.x, warnings, 'width')
    const y = clampOnPlaneAxis(surfaceLocal.y, plane.height, componentSize.y, warnings, 'height')
    pushBoundaryWarning(warnings, x.clamped || y.clamped)
    return { anchor: roundVec3(planeLocalToWorld({ ...surfaceLocal, x: x.value, y: y.value }, plane)), warnings }
  }

  const x = clampOnPlaneAxis(local.x, plane.width, componentSize.x, warnings, 'width')
  const y = clampOnPlaneAxis(local.y, plane.height, componentSize.z, warnings, 'depth')
  pushBoundaryWarning(warnings, x.clamped || y.clamped)
  return { anchor: roundVec3(planeLocalToWorld({ ...local, x: x.value, y: y.value }, plane)), warnings }
}

function normalizePlaneSurfaceLocal(local: Vec3, surfaceAnchor: Vec3 | undefined, plane: PlaneSpec): Vec3 {
  if (!surfaceAnchor) return local
  return {
    ...local,
    z: worldToPlaneLocal(surfaceAnchor, plane).z,
  }
}

function wallSurfaceLocal(local: Vec3, mode: ComponentPlacementMode): Vec3 {
  return mode === 'wall' ? { ...local, z: WALL_SURFACE_LOCAL_Z } : local
}

function clampOnPlaneAxis(value: number, planeExtent: number, componentExtent: number, warnings: ComponentPlacementWarning[], axis: 'width' | 'height' | 'depth') {
  const min = -planeExtent / 2 + componentExtent / 2
  const max = planeExtent / 2 - componentExtent / 2
  if (min > max) {
    warnings.push(`component-${axis}-exceeds-plane`)
    return { value: 0, clamped: false }
  }
  const clamped = value < min || value > max
  return { value: Math.min(max, Math.max(min, value)), clamped }
}

function pushBoundaryWarning(warnings: ComponentPlacementWarning[], clamped: boolean) {
  if (clamped && !warnings.includes('component-anchor-clamped')) warnings.push('component-anchor-clamped')
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
