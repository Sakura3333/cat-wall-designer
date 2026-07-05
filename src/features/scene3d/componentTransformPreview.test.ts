import { Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import type { PlaneSpec, SceneComponent } from '../../domain/scene/types'
import { applyConstrainedComponentTransformPreview } from './componentTransformPreview'

const wallPlane: PlaneSpec = {
  id: 'wall-1',
  name: 'Wall',
  type: 'wall',
  width: 3,
  height: 2.4,
  textureEnabled: false,
  uvMode: 'auto',
  position: { x: 0, y: 1.2, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
}

const floorPlane: PlaneSpec = {
  id: 'floor-1',
  name: 'Floor',
  type: 'floor',
  width: 3,
  height: 2,
  textureEnabled: false,
  uvMode: 'auto',
  position: { x: 0, y: 0, z: 1 },
  rotation: { x: -Math.PI / 2, y: 0, z: 0 },
}

const sideWallPlane: PlaneSpec = {
  id: 'wall-side',
  name: 'Side Wall',
  type: 'wall',
  width: 3,
  height: 2.4,
  textureEnabled: false,
  uvMode: 'auto',
  position: { x: 1.5, y: 1.2, z: 0 },
  rotation: { x: 0, y: Math.PI / 2, z: 0 },
}

describe('applyConstrainedComponentTransformPreview', () => {
  it('projects wall component preview movement back to the contact surface immediately', () => {
    const object = new Object3D()
    object.position.set(2, 3, 2)
    object.rotation.set(0.1, 0.2, 0.3)

    applyConstrainedComponentTransformPreview(object, wallComponent(), [wallPlane])

    expect(toPlainVec3(object.position)).toEqual({ x: 1.14, y: 2.23, z: 0.11 })
    expect(toPlainVec3(object.rotation)).toEqual({ x: 0.1, y: 0.2, z: 0.3 })
  })

  it('reattaches and rotates wall previews when moved across walls', () => {
    const object = new Object3D()
    object.position.set(2, 1.4, -0.4)
    object.rotation.set(0, 0, 0)

    applyConstrainedComponentTransformPreview(object, wallComponent(), [wallPlane, sideWallPlane])

    expect(toPlainVec3(object.position)).toEqual({ x: 1.61, y: 1.4, z: -0.4 })
    expect(toPlainVec3(object.rotation)).toEqual({ x: 0, y: 1.570796, z: 0 })
  })

  it('projects floor component preview movement back to the floor immediately', () => {
    const object = new Object3D()
    object.position.set(2, 3, -1)

    applyConstrainedComponentTransformPreview(object, floorComponent(), [floorPlane])

    expect(toPlainVec3(object.position)).toEqual({ x: 1.19, y: 0.12, z: 0.24 })
  })

  it('leaves free component previews unconstrained', () => {
    const object = new Object3D()
    object.position.set(2, 3, 4)
    object.rotation.set(0.1, 0.2, 0.3)

    applyConstrainedComponentTransformPreview(object, freeComponent(), [wallPlane, floorPlane])

    expect(toPlainVec3(object.position)).toEqual({ x: 2, y: 3, z: 4 })
    expect(toPlainVec3(object.rotation)).toEqual({ x: 0.1, y: 0.2, z: 0.3 })
  })
})

function wallComponent(): SceneComponent {
  return {
    id: 'component-wall',
    kind: 'cat-shelf',
    name: 'Cat Shelf',
    targetPlaneId: 'wall-1',
    placement: {
      mode: 'wall',
      targetPlaneId: 'wall-1',
      anchor: { x: 0.4, y: 1.3, z: 0.02 },
      normal: { x: 0, y: 0, z: 1 },
    },
    position: { x: 0.4, y: 1.3, z: 0.11 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 0.72, y: 0.34, z: 0.18 },
  }
}

function floorComponent(): SceneComponent {
  return {
    id: 'component-floor',
    kind: 'cat-bed',
    name: 'Cat Bed',
    targetPlaneId: 'floor-1',
    placement: {
      mode: 'floor',
      targetPlaneId: 'floor-1',
      anchor: { x: 0.4, y: 0, z: 0.7 },
      normal: { x: 0, y: 1, z: 0 },
    },
    position: { x: 0.4, y: 0.12, z: 0.7 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 0.62, y: 0.24, z: 0.48 },
  }
}

function freeComponent(): SceneComponent {
  return {
    id: 'component-free',
    kind: 'free-prop',
    name: 'Free Prop',
    placement: {
      mode: 'free',
      anchor: { x: 0.4, y: 1.3, z: 0.02 },
      normal: { x: 0, y: 0, z: 1 },
    },
    position: { x: 0.4, y: 1.3, z: 0.1 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 0.46, y: 0.28, z: 0.14 },
  }
}

function toPlainVec3(vector: { x: number; y: number; z: number }) {
  return {
    x: Number(vector.x.toFixed(6)),
    y: Number(vector.y.toFixed(6)),
    z: Number(vector.z.toFixed(6)),
  }
}
