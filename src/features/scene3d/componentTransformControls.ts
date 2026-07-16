import type { SceneComponent, TransformMode } from '../../domain/scene/types'

export type TransformControlOptions = {
  space: 'world' | 'local'
  showX: boolean
  showY: boolean
  showZ: boolean
}

const allWorldAxes: TransformControlOptions = {
  space: 'world',
  showX: true,
  showY: true,
  showZ: true,
}

export function buildComponentTransformControlOptions(component: SceneComponent | null, transformMode: TransformMode): TransformControlOptions {
  if (!component || transformMode === 'select') return allWorldAxes

  const placementMode = component.placement?.mode ?? 'free'
  if (placementMode === 'wall') {
    // Wall components keep their local Z axis normal to the wall surface.
    return transformMode === 'rotate'
      ? { space: 'local', showX: false, showY: false, showZ: true }
      : { space: 'local', showX: true, showY: true, showZ: false }
  }

  if (placementMode === 'floor') {
    // Floor components keep their local Y axis normal to the floor surface.
    return transformMode === 'rotate'
      ? { space: 'local', showX: false, showY: true, showZ: false }
      : { space: 'local', showX: true, showY: false, showZ: true }
  }

  return allWorldAxes
}
