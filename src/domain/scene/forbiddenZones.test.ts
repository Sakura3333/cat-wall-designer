import { describe, expect, it } from 'vitest'
import type { ForbiddenZone, PlaneSpec, SceneComponent } from './types'
import {
  addForbiddenZoneAnchor,
  buildForbiddenZoneFromDrag,
  findBlockingComponentForForbiddenZone,
  findBlockingForbiddenZone,
  getForbiddenZoneCenter,
  getForbiddenZoneSize,
  removeForbiddenZoneAnchor,
  resizeForbiddenZone,
  updateForbiddenZoneAnchor,
} from './forbiddenZones'

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

describe('forbiddenZones', () => {
  it('builds a rectangle polygon from a drag gesture', () => {
    const zone = buildForbiddenZoneFromDrag({
      id: 'zone-1',
      name: 'No shelf',
      planeId: 'wall-1',
      shape: 'polygon',
      start: { x: 0.4, y: 0.2 },
      end: { x: -0.2, y: 0.8 },
    })

    expect(zone).toEqual({
      id: 'zone-1',
      name: 'No shelf',
      planeId: 'wall-1',
      shape: 'polygon',
      points: [
        { x: -0.2, y: 0.2 },
        { x: 0.4, y: 0.2 },
        { x: 0.4, y: 0.8 },
        { x: -0.2, y: 0.8 },
      ],
    })
    expect(getForbiddenZoneCenter(zone)).toEqual({ x: 0.1, y: 0.5 })
    expect(getForbiddenZoneSize(zone)).toEqual({ x: 0.6, y: 0.6 })
  })

  it('builds an ellipse from a drag gesture', () => {
    const zone = buildForbiddenZoneFromDrag({
      id: 'zone-1',
      name: 'No bed',
      planeId: 'floor-1',
      shape: 'ellipse',
      start: { x: -0.6, y: -0.4 },
      end: { x: 0.2, y: 0.8 },
    })

    expect(zone).toMatchObject({
      shape: 'ellipse',
      center: { x: -0.2, y: 0.2 },
      radiusX: 0.4,
      radiusY: 0.6,
    })
    expect(getForbiddenZoneSize(zone)).toEqual({ x: 0.8, y: 1.2 })
  })

  it('adds, moves, and removes polygon anchors', () => {
    const zone = buildForbiddenZoneFromDrag({
      id: 'zone-1',
      name: 'No shelf',
      planeId: 'wall-1',
      shape: 'polygon',
      start: { x: -0.5, y: -0.5 },
      end: { x: 0.5, y: 0.5 },
    })

    const withAnchor = addForbiddenZoneAnchor(zone)
    expect(withAnchor.points).toHaveLength(5)

    const moved = updateForbiddenZoneAnchor(withAnchor, 1, { x: 0.15, y: -0.75 })
    expect(moved.points?.[1]).toEqual({ x: 0.15, y: -0.75 })

    const removed = removeForbiddenZoneAnchor(moved, 1)
    expect(removed.points).toHaveLength(4)
  })

  it('resizes polygons around their current center', () => {
    const zone = buildForbiddenZoneFromDrag({
      id: 'zone-1',
      name: 'No shelf',
      planeId: 'wall-1',
      shape: 'polygon',
      start: { x: -0.5, y: -0.25 },
      end: { x: 0.5, y: 0.25 },
    })

    const resized = resizeForbiddenZone(zone, { x: 2, y: 1 })
    expect(getForbiddenZoneCenter(resized)).toEqual({ x: 0, y: 0 })
    expect(getForbiddenZoneSize(resized)).toEqual({ x: 2, y: 1 })
  })

  it('finds polygon zones that block wall component footprints', () => {
    const zone: ForbiddenZone = {
      id: 'zone-1',
      name: 'No shelf',
      planeId: 'wall-1',
      shape: 'polygon',
      points: [
        { x: -0.3, y: -0.3 },
        { x: 0.3, y: -0.3 },
        { x: 0.3, y: 0.3 },
        { x: -0.3, y: 0.3 },
      ],
    }
    const component: SceneComponent = {
      id: 'component-1',
      kind: 'cat-shelf',
      name: 'Shelf',
      targetPlaneId: 'wall-1',
      placement: {
        mode: 'wall',
        targetPlaneId: 'wall-1',
        anchor: { x: 0, y: 1.2, z: 0.05 },
        normal: { x: 0, y: 0, z: 1 },
      },
      position: { x: 0, y: 1.2, z: 0.15 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { x: 0.4, y: 0.3, z: 0.2 },
    }

    expect(findBlockingForbiddenZone(component, [wallPlane], [zone])?.id).toBe('zone-1')
  })

  it('finds ellipse zones that block floor component footprints', () => {
    const zone: ForbiddenZone = {
      id: 'zone-1',
      name: 'No bed',
      planeId: 'floor-1',
      shape: 'ellipse',
      center: { x: 0.4, y: 0.3 },
      radiusX: 0.35,
      radiusY: 0.35,
    }
    const component: SceneComponent = {
      id: 'component-1',
      kind: 'cat-bed',
      name: 'Bed',
      targetPlaneId: 'floor-1',
      placement: {
        mode: 'floor',
        targetPlaneId: 'floor-1',
        anchor: { x: 0.4, y: 0, z: 0.7 },
        normal: { x: 0, y: 1, z: 0 },
      },
      position: { x: 0.4, y: 0.12, z: 0.7 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { x: 0.4, y: 0.24, z: 0.4 },
    }

    expect(findBlockingForbiddenZone(component, [floorPlane], [zone])?.id).toBe('zone-1')
  })

  it('finds components that block forbidden zone placement', () => {
    const component: SceneComponent = {
      id: 'component-1',
      kind: 'cat-shelf',
      name: 'Shelf',
      targetPlaneId: 'wall-1',
      placement: {
        mode: 'wall',
        targetPlaneId: 'wall-1',
        anchor: { x: 0, y: 1.2, z: 0.05 },
        normal: { x: 0, y: 0, z: 1 },
      },
      position: { x: 0, y: 1.2, z: 0.15 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { x: 0.4, y: 0.3, z: 0.2 },
    }
    const zone: ForbiddenZone = {
      id: 'zone-1',
      name: 'No shelf',
      planeId: 'wall-1',
      shape: 'polygon',
      points: [
        { x: -0.25, y: -0.2 },
        { x: 0.25, y: -0.2 },
        { x: 0.25, y: 0.2 },
        { x: -0.25, y: 0.2 },
      ],
    }

    expect(findBlockingComponentForForbiddenZone(zone, [component], [wallPlane])?.id).toBe('component-1')
  })
})
