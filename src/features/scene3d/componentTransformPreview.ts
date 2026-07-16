import type { Euler, Object3D, Vector3 } from 'three'
import { getComponentCatalogItem } from '../../domain/scene/componentCatalog'
import { constrainComponentTransform } from '../../domain/scene/componentPlacement'
import { findBlockingForbiddenZone } from '../../domain/scene/forbiddenZones'
import type { ForbiddenZone, PlaneSpec, SceneComponent, Vec3 } from '../../domain/scene/types'

export function applyConstrainedComponentTransformPreview(object: Pick<Object3D, 'position' | 'rotation' | 'updateMatrixWorld'>, component: SceneComponent, planes: PlaneSpec[], forbiddenZones: ForbiddenZone[] = []): SceneComponent {
  const catalogItem = getComponentCatalogItem(component.kind)
  const patch = constrainComponentTransform(
    component,
    {
      position: toVec3(object.position),
      rotation: toVec3(object.rotation),
    },
    planes,
    {
      defaultSize: catalogItem?.defaultSize,
      defaultRotation: catalogItem?.defaultRotation,
    },
  )
  const previewComponent = {
    ...component,
    ...patch,
  }

  if (findBlockingForbiddenZone(previewComponent, planes, forbiddenZones)) {
    object.position.set(component.position.x, component.position.y, component.position.z)
    object.rotation.set(component.rotation.x, component.rotation.y, component.rotation.z)
    object.updateMatrixWorld()
    return component
  }

  if (patch.position) {
    object.position.set(patch.position.x, patch.position.y, patch.position.z)
  }

  if (patch.rotation) {
    object.rotation.set(patch.rotation.x, patch.rotation.y, patch.rotation.z)
  }

  object.updateMatrixWorld()
  return previewComponent
}

function toVec3(vector: Vector3 | Euler): Vec3 {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  }
}
