import type { Euler, Object3D, Vector3 } from 'three'
import { getComponentCatalogItem } from '../../domain/scene/componentCatalog'
import { constrainComponentTransform } from '../../domain/scene/componentPlacement'
import type { PlaneSpec, SceneComponent, Vec3 } from '../../domain/scene/types'

export function applyConstrainedComponentTransformPreview(object: Pick<Object3D, 'position' | 'rotation' | 'updateMatrixWorld'>, component: SceneComponent, planes: PlaneSpec[]) {
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

  if (patch.position) {
    object.position.set(patch.position.x, patch.position.y, patch.position.z)
  }

  if (patch.rotation) {
    object.rotation.set(patch.rotation.x, patch.rotation.y, patch.rotation.z)
  }

  object.updateMatrixWorld()
}

function toVec3(vector: Vector3 | Euler): Vec3 {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  }
}
