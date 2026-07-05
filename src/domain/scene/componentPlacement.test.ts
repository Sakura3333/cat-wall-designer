import { describe, expect, it } from 'vitest'
import { buildComponentPlacement, canPlaceOnHit, clampAnchorToPlaneBoundsWithWarnings, constrainComponentTransform, type ComponentPlacementResult, type ComponentPlacementSpec } from './componentPlacement'
import type { ComponentPlacementHit, PlaneSpec, SceneComponent } from './types'

const wallPlane: PlaneSpec = {
  id: 'wall-1',
  name: 'Wall',
  type: 'wall',
  width: 2,
  height: 2,
  textureEnabled: false,
  uvMode: 'auto',
  position: { x: 0, y: 1, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
}

const floorPlane: PlaneSpec = {
  id: 'floor-1',
  name: 'Floor',
  type: 'floor',
  width: 2,
  height: 3,
  textureEnabled: false,
  uvMode: 'auto',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: -Math.PI / 2, y: 0, z: 0 },
}

const sideWallPlane: PlaneSpec = {
  id: 'wall-side',
  name: 'Side Wall',
  type: 'wall',
  width: 2,
  height: 2,
  textureEnabled: false,
  uvMode: 'auto',
  position: { x: 1, y: 1, z: 0 },
  rotation: { x: 0, y: Math.PI / 2, z: 0 },
}

const wallSpec: ComponentPlacementSpec = {
  placement: 'wall',
  defaultSize: { x: 0.4, y: 0.3, z: 0.2 },
  defaultRotation: { x: 0, y: 0, z: 0 },
}

const floorSpec: ComponentPlacementSpec = {
  placement: 'floor',
  defaultSize: { x: 0.4, y: 0.4, z: 0.5 },
  defaultRotation: { x: 0, y: 0, z: 0 },
}

const freeSpec: ComponentPlacementSpec = {
  placement: 'free',
  defaultSize: { x: 0.4, y: 0.4, z: 0.4 },
  defaultRotation: { x: 0, y: 0.25, z: 0 },
}

describe('canPlaceOnHit', () => {
  it('accepts only compatible contact surfaces for bound components', () => {
    expect(canPlaceOnHit('wall', hit({ planeId: 'wall-1', planeType: 'wall', surface: 'front' }))).toBe(true)
    expect(canPlaceOnHit('wall', hit({ planeId: 'wall-1', planeType: 'wall', surface: 'side' }))).toBe(false)
    expect(canPlaceOnHit('wall', hit({ planeId: 'floor-1', planeType: 'floor', surface: 'top' }))).toBe(false)

    expect(canPlaceOnHit('floor', hit({ planeId: 'floor-1', planeType: 'floor', surface: 'top' }))).toBe(true)
    expect(canPlaceOnHit('floor', hit({ planeId: 'floor-1', planeType: 'floor', surface: 'side' }))).toBe(false)
    expect(canPlaceOnHit('floor', hit({ planeId: 'wall-1', planeType: 'wall', surface: 'front' }))).toBe(false)
  })

  it('allows free components to use any scene hit as an initial reference', () => {
    expect(canPlaceOnHit('free', hit({ planeId: 'wall-1', planeType: 'wall', surface: 'side' }))).toBe(true)
    expect(canPlaceOnHit('free', hit({ planeId: 'floor-1', planeType: 'floor', surface: 'top' }))).toBe(true)
  })
})

describe('buildComponentPlacement', () => {
  it('places wall components with the center offset by half depth', () => {
    const result = placed(
      buildComponentPlacement(
        wallSpec,
        hit({
          planeId: 'wall-1',
          planeType: 'wall',
          point: { x: 0.3, y: 1.2, z: 0.05 },
          normal: { x: 0, y: 0, z: 1 },
          surface: 'front',
        }),
        [wallPlane, floorPlane],
      ),
    )

    expect(result.placement).toEqual({
      mode: 'wall',
      targetPlaneId: 'wall-1',
      anchor: { x: 0.3, y: 1.2, z: 0.05 },
      normal: { x: 0, y: 0, z: 1 },
    })
    expect(result.position).toEqual({ x: 0.3, y: 1.2, z: 0.15 })
    expect(result.rotation).toEqual({ x: 0, y: 0, z: 0 })
    expect(result.warnings).toEqual([])
  })

  it('places floor components with the center offset by half height', () => {
    const result = placed(
      buildComponentPlacement(
        floorSpec,
        hit({
          planeId: 'floor-1',
          planeType: 'floor',
          point: { x: 0.25, y: 0.02, z: 0.5 },
          normal: { x: 0, y: 1, z: 0 },
          surface: 'top',
        }),
        [wallPlane, floorPlane],
      ),
    )

    expect(result.placement).toEqual({
      mode: 'floor',
      targetPlaneId: 'floor-1',
      anchor: { x: 0.25, y: 0.02, z: 0.5 },
      normal: { x: 0, y: 1, z: 0 },
    })
    expect(result.position).toEqual({ x: 0.25, y: 0.22, z: 0.5 })
    expect(result.rotation).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('keeps free components unbound and offsets from the hit point slightly', () => {
    const result = placed(
      buildComponentPlacement(
        freeSpec,
        hit({
          planeId: 'wall-1',
          planeType: 'wall',
          point: { x: 1, y: 2, z: 3 },
          normal: { x: 0, y: 0, z: 2 },
          surface: 'front',
        }),
        [wallPlane, floorPlane],
      ),
    )

    expect(result.placement).toEqual({
      mode: 'free',
      anchor: { x: 1, y: 2, z: 3 },
      normal: { x: 0, y: 0, z: 1 },
    })
    expect(result.position).toEqual({ x: 1, y: 2, z: 3.08 })
    expect(result.rotation).toEqual({ x: 0, y: 0.25, z: 0 })
  })

  it('clamps anchors so wall components stay inside the plane bounds', () => {
    const result = placed(
      buildComponentPlacement(
        wallSpec,
        hit({
          planeId: 'wall-1',
          planeType: 'wall',
          point: { x: 1, y: 2.5, z: 0.05 },
          normal: { x: 0, y: 0, z: 1 },
          surface: 'front',
        }),
        [wallPlane, floorPlane],
      ),
    )

    expect(result.placement.anchor).toEqual({ x: 0.8, y: 1.85, z: 0.05 })
    expect(result.position).toEqual({ x: 0.8, y: 1.85, z: 0.15 })
    expect(result.warnings).toContain('component-anchor-clamped')
  })

  it('clamps anchors so floor components stay inside the plane footprint', () => {
    const result = placed(
      buildComponentPlacement(
        floorSpec,
        hit({
          planeId: 'floor-1',
          planeType: 'floor',
          point: { x: 1.4, y: 0, z: -1.7 },
          normal: { x: 0, y: 1, z: 0 },
          surface: 'top',
        }),
        [wallPlane, floorPlane],
      ),
    )

    expect(result.placement.anchor).toEqual({ x: 0.8, y: 0, z: -1.25 })
    expect(result.position).toEqual({ x: 0.8, y: 0.2, z: -1.25 })
    expect(result.warnings).toContain('component-anchor-clamped')
  })

  it('clamps in the target plane local space when the wall is rotated', () => {
    const result = placed(
      buildComponentPlacement(
        wallSpec,
        hit({
          planeId: 'wall-side',
          planeType: 'wall',
          point: { x: 1.05, y: 2.9, z: -1.2 },
          normal: { x: 1, y: 0, z: 0 },
          surface: 'front',
        }),
        [sideWallPlane],
      ),
    )

    expect(result.placement.anchor).toEqual({ x: 1.05, y: 1.85, z: -0.8 })
    expect(result.placement.normal).toEqual({ x: 1, y: 0, z: 0 })
    expect(result.position).toEqual({ x: 1.15, y: 1.85, z: -0.8 })
    expect(result.rotation).toEqual({ x: 0, y: 1.570796, z: 0 })
  })

  it('warns but still places oversized components at the plane center', () => {
    const result = placed(
      buildComponentPlacement(
        {
          ...wallSpec,
          defaultSize: { x: 2.4, y: 0.3, z: 0.2 },
        },
        hit({
          planeId: 'wall-1',
          planeType: 'wall',
          point: { x: 0.6, y: 1, z: 0.05 },
          normal: { x: 0, y: 0, z: 1 },
          surface: 'front',
        }),
        [wallPlane, floorPlane],
      ),
    )

    expect(result.placement.anchor).toEqual({ x: 0, y: 1, z: 0.05 })
    expect(result.position).toEqual({ x: 0, y: 1, z: 0.15 })
    expect(result.warnings).toContain('component-width-exceeds-plane')
  })

  it('reports all oversized floor footprint axes while preserving the plane center', () => {
    const result = placed(
      buildComponentPlacement(
        {
          ...floorSpec,
          defaultSize: { x: 2.4, y: 0.4, z: 3.4 },
        },
        hit({
          planeId: 'floor-1',
          planeType: 'floor',
          point: { x: 0.6, y: 0, z: 0.8 },
          normal: { x: 0, y: 1, z: 0 },
          surface: 'top',
        }),
        [floorPlane],
      ),
    )

    expect(result.placement.anchor).toEqual({ x: 0, y: 0, z: 0 })
    expect(result.position).toEqual({ x: 0, y: 0.2, z: 0 })
    expect(result.warnings).toEqual(['component-width-exceeds-plane', 'component-depth-exceeds-plane'])
  })

  it('rejects missing or incompatible hits', () => {
    expect(buildComponentPlacement(wallSpec, null, [wallPlane])).toMatchObject({
      canPlace: false,
      reason: 'missing-hit',
    })
    expect(
      buildComponentPlacement(
        wallSpec,
        hit({
          planeId: 'floor-1',
          planeType: 'floor',
          surface: 'top',
        }),
        [wallPlane, floorPlane],
      ),
    ).toMatchObject({
      canPlace: false,
      reason: 'incompatible-surface',
    })
  })
})

describe('clampAnchorToPlaneBoundsWithWarnings', () => {
  it('returns a typed warning result for callers that need to surface boundary state', () => {
    const result = clampAnchorToPlaneBoundsWithWarnings({ x: 1, y: 1, z: 0 }, wallPlane, { x: 2.4, y: 2.6, z: 0.2 }, 'wall')

    expect(result.anchor).toEqual({ x: 0, y: 1, z: 0 })
    expect(result.warnings).toEqual(['component-width-exceeds-plane', 'component-height-exceeds-plane'])
  })

  it('reports when an otherwise valid anchor is clamped to the boundary', () => {
    const result = clampAnchorToPlaneBoundsWithWarnings({ x: 1.3, y: 1, z: 0 }, wallPlane, { x: 0.4, y: 0.3, z: 0.2 }, 'wall')

    expect(result.anchor).toEqual({ x: 0.8, y: 1, z: 0 })
    expect(result.warnings).toEqual(['component-anchor-clamped'])
  })
})

describe('constrainComponentTransform', () => {
  it('keeps wall components attached to their original contact surface after movement', () => {
    const component = sceneComponent({
      placement: {
        mode: 'wall',
        targetPlaneId: 'wall-1',
        anchor: { x: 0.3, y: 1.2, z: 0.05 },
        normal: { x: 0, y: 0, z: 1 },
      },
      position: { x: 0.3, y: 1.2, z: 0.15 },
      size: wallSpec.defaultSize,
    })

    const patch = constrainComponentTransform(component, { position: { x: 1.5, y: 2.5, z: 1 } }, [wallPlane])

    expect(patch.position).toEqual({ x: 0.8, y: 1.85, z: 0.15 })
    expect(patch.placement).toMatchObject({
      mode: 'wall',
      targetPlaneId: 'wall-1',
      anchor: { x: 0.8, y: 1.85, z: 0.05 },
      normal: { x: 0, y: 0, z: 1 },
    })
  })

  it('reattaches wall components to the closest wall and rotates them across walls', () => {
    const component = sceneComponent({
      placement: {
        mode: 'wall',
        targetPlaneId: 'wall-1',
        anchor: { x: 0.3, y: 1.2, z: 0.05 },
        normal: { x: 0, y: 0, z: 1 },
      },
      targetPlaneId: 'wall-1',
      position: { x: 0.3, y: 1.2, z: 0.15 },
      rotation: { x: 0, y: 0, z: 0 },
      size: wallSpec.defaultSize,
    })

    const patch = constrainComponentTransform(component, { position: { x: 1.7, y: 1.5, z: -0.3 } }, [wallPlane, sideWallPlane])

    expect(patch.targetPlaneId).toBe('wall-side')
    expect(patch.position).toEqual({ x: 1.15, y: 1.5, z: -0.3 })
    expect(patch.rotation).toEqual({ x: 0, y: 1.570796, z: 0 })
    expect(patch.placement).toMatchObject({
      mode: 'wall',
      targetPlaneId: 'wall-side',
      anchor: { x: 1.05, y: 1.5, z: -0.3 },
      normal: { x: 1, y: 0, z: 0 },
    })
  })

  it('keeps floor components grounded after movement', () => {
    const component = sceneComponent({
      placement: {
        mode: 'floor',
        targetPlaneId: 'floor-1',
        anchor: { x: 0.2, y: 0, z: 0.4 },
        normal: { x: 0, y: 1, z: 0 },
      },
      position: { x: 0.2, y: 0.2, z: 0.4 },
      size: floorSpec.defaultSize,
    })

    const patch = constrainComponentTransform(component, { position: { x: 1.5, y: 2, z: -1.8 } }, [floorPlane])

    expect(patch.position).toEqual({ x: 0.8, y: 0.2, z: -1.25 })
    expect(patch.placement).toMatchObject({
      mode: 'floor',
      targetPlaneId: 'floor-1',
      anchor: { x: 0.8, y: 0, z: -1.25 },
      normal: { x: 0, y: 1, z: 0 },
    })
  })

  it('recalculates the center when a bound component changes size', () => {
    const component = sceneComponent({
      placement: {
        mode: 'wall',
        targetPlaneId: 'wall-1',
        anchor: { x: 0.3, y: 1.2, z: 0.05 },
        normal: { x: 0, y: 0, z: 1 },
      },
      position: { x: 0.3, y: 1.2, z: 0.15 },
      size: wallSpec.defaultSize,
    })

    const patch = constrainComponentTransform(component, { size: { x: 0.4, y: 0.3, z: 0.4 } }, [wallPlane])

    expect(patch.size).toEqual({ x: 0.4, y: 0.3, z: 0.4 })
    expect(patch.position).toEqual({ x: 0.3, y: 1.2, z: 0.25 })
    expect(patch.placement).toMatchObject({
      anchor: { x: 0.3, y: 1.2, z: 0.05 },
    })
  })

  it('leaves free components unconstrained', () => {
    const component = sceneComponent({
      placement: { mode: 'free' },
      position: { x: 0, y: 0, z: 0 },
    })
    const patch = { position: { x: 4, y: 5, z: 6 }, rotation: { x: 0.2, y: 0.3, z: 0.4 } }

    expect(constrainComponentTransform(component, patch, [wallPlane, floorPlane])).toBe(patch)
  })
})

type PlacedResult = Extract<ComponentPlacementResult, { canPlace: true }>

function placed(result: ComponentPlacementResult): PlacedResult {
  if (!result.canPlace) throw new Error(result.reason)
  return result
}

function hit(patch: Partial<ComponentPlacementHit>): ComponentPlacementHit {
  return {
    planeId: 'wall-1',
    planeType: 'wall',
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    ...patch,
  }
}

function sceneComponent(patch: Partial<SceneComponent>): SceneComponent {
  return {
    id: 'component-1',
    kind: 'test-component',
    name: 'Test Component',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    size: { x: 0.4, y: 0.4, z: 0.4 },
    ...patch,
  }
}
