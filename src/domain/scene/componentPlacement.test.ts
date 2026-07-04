import { describe, expect, it } from 'vitest'
import { buildComponentPlacement, canPlaceOnHit, type ComponentPlacementResult, type ComponentPlacementSpec } from './componentPlacement'
import type { ComponentPlacementHit, PlaneSpec } from './types'

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
