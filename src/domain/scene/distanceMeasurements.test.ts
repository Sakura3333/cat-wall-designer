import { describe, expect, it } from 'vitest'
import { buildDistanceMeasurements, formatDistance } from './distanceMeasurements'
import type { ForbiddenZone, PlaneSpec, Project, SceneComponent } from './types'

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

const componentSize = { x: 0.4, y: 0.3, z: 0.2 }

describe('buildDistanceMeasurements', () => {
  it('measures selected wall component clearance to other components on the same plane', () => {
    const measurements = buildDistanceMeasurements(project([wallComponent('component-a', { x: -0.4, y: 1, z: 0.05 }), wallComponent('component-b', { x: 0.4, y: 1, z: 0.05 })]), 'component-a')
    const pair = measurements.find((measurement) => measurement.kind === 'component-component')

    expect(pair).toMatchObject({
      componentIds: ['component-a', 'component-b'],
      distanceMeters: 0.4,
      label: '间距 40 cm',
      start: { x: -0.2, y: 1, z: 0.085 },
      end: { x: 0.2, y: 1, z: 0.085 },
      targetPlaneId: 'wall-1',
    })
  })

  it('measures selected component distance to each target plane edge', () => {
    const measurements = buildDistanceMeasurements(project([wallComponent('component-a', { x: -0.4, y: 1, z: 0.05 })]), 'component-a')
    const edges = new Map(measurements.filter((measurement) => measurement.kind === 'component-plane-edge').map((measurement) => [measurement.edge, measurement]))

    expect(edges.get('left')).toMatchObject({ distanceMeters: 0.4, label: '左边 40 cm' })
    expect(edges.get('right')).toMatchObject({ distanceMeters: 1.2, label: '右边 1.20 m' })
    expect(edges.get('bottom')).toMatchObject({ distanceMeters: 0.85, label: '下边 85 cm' })
    expect(edges.get('top')).toMatchObject({ distanceMeters: 0.85, label: '上边 85 cm' })
  })

  it('measures selected wall component distance to the top surface of the floor', () => {
    const measurements = buildDistanceMeasurements(project([wallComponent('component-a', { x: -0.4, y: 1, z: 0.05 })]), 'component-a')
    const ground = measurements.find((measurement) => measurement.kind === 'component-ground')

    expect(ground).toMatchObject({
      distanceMeters: 0.81,
      label: '离地 81 cm',
      start: { x: -0.4, y: 0.85, z: 0.085 },
      end: { x: -0.4, y: 0.04, z: 0.085 },
    })
  })

  it('shows only the nearest component pair on each plane when no component is selected', () => {
    const measurements = buildDistanceMeasurements(
      project([
        wallComponent('component-a', { x: -0.7, y: 1, z: 0.05 }),
        wallComponent('component-b', { x: 0, y: 1, z: 0.05 }),
        wallComponent('component-c', { x: 0.7, y: 1, z: 0.05 }),
      ]),
      null,
    )

    expect(measurements).toHaveLength(1)
    expect(measurements[0]).toMatchObject({
      kind: 'component-component',
      distanceMeters: 0.3,
    })
  })

  it('measures only the nearest selected component neighbor in each direction', () => {
    const measurements = buildDistanceMeasurements(
      project([
        wallComponent('selected', { x: 0, y: 1, z: 0.05 }),
        wallComponent('left-near', { x: -0.5, y: 1, z: 0.05 }),
        wallComponent('left-far', { x: -0.9, y: 1, z: 0.05 }),
        wallComponent('right-near', { x: 0.5, y: 1, z: 0.05 }),
        wallComponent('top-near', { x: 0, y: 1.5, z: 0.05 }),
        wallComponent('bottom-near', { x: 0, y: 0.5, z: 0.05 }),
      ]),
      'selected',
    )
    const pairs = measurements.filter((measurement) => measurement.kind === 'component-component')
    const byEdge = new Map(pairs.map((measurement) => [measurement.edge, measurement.componentIds]))

    expect(pairs).toHaveLength(4)
    expect(byEdge.get('left')).toEqual(['left-near', 'selected'])
    expect(byEdge.get('right')).toEqual(['right-near', 'selected'])
    expect(byEdge.get('top')).toEqual(['selected', 'top-near'])
    expect(byEdge.get('bottom')).toEqual(['bottom-near', 'selected'])
  })

  it('measures selected forbidden zone distance to each target plane edge', () => {
    const zone: ForbiddenZone = {
      id: 'zone-a',
      name: 'No drill',
      planeId: 'wall-1',
      shape: 'polygon',
      points: [
        { x: -0.4, y: -0.3 },
        { x: 0.2, y: -0.3 },
        { x: 0.2, y: 0.1 },
        { x: -0.4, y: 0.1 },
      ],
    }
    const measurements = buildDistanceMeasurements({ ...project([]), forbiddenZones: [zone] }, 'zone-a')
    const edges = new Map(measurements.filter((measurement) => measurement.kind === 'forbidden-zone-plane-edge').map((measurement) => [measurement.edge, measurement]))

    expect(edges.get('left')).toMatchObject({ distanceMeters: 0.6, forbiddenZoneIds: ['zone-a'] })
    expect(edges.get('right')).toMatchObject({ distanceMeters: 0.8, forbiddenZoneIds: ['zone-a'] })
    expect(edges.get('bottom')).toMatchObject({ distanceMeters: 0.7, forbiddenZoneIds: ['zone-a'] })
    expect(edges.get('top')).toMatchObject({ distanceMeters: 0.9, forbiddenZoneIds: ['zone-a'] })
  })
})

describe('formatDistance', () => {
  it('formats short measurements as centimeters and long measurements as meters', () => {
    expect(formatDistance(0.345)).toBe('35 cm')
    expect(formatDistance(1.2)).toBe('1.20 m')
  })
})

function project(components: SceneComponent[]): Pick<Project, 'components' | 'planes'> {
  return {
    planes: [wallPlane, floorPlane],
    components,
  }
}

function wallComponent(id: string, anchor: SceneComponent['position']): SceneComponent {
  return {
    id,
    kind: 'test-component',
    name: id,
    targetPlaneId: 'wall-1',
    placement: {
      mode: 'wall',
      targetPlaneId: 'wall-1',
      anchor,
      normal: { x: 0, y: 0, z: 1 },
    },
    position: { x: anchor.x, y: anchor.y, z: anchor.z + componentSize.z / 2 },
    rotation: { x: 0, y: 0, z: 0 },
    size: componentSize,
  }
}
