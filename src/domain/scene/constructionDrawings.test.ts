import { describe, expect, it } from 'vitest'
import { buildConstructionDrawingSet, formatConstructionDimension, formatPrice } from './constructionDrawings'
import type { PlaneSpec, Project, SceneComponent } from './types'

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

const sideWallPlane: PlaneSpec = {
  id: 'wall-2',
  name: 'Side Wall',
  type: 'wall',
  width: 1.6,
  height: 2,
  textureEnabled: false,
  uvMode: 'auto',
  position: { x: 1, y: 1, z: 0.8 },
  rotation: { x: 0, y: -Math.PI / 2, z: 0 },
}

const floorPlane: PlaneSpec = {
  id: 'floor-1',
  name: 'Floor',
  type: 'floor',
  width: 2,
  height: 3,
  textureEnabled: false,
  uvMode: 'auto',
  position: { x: 0, y: 0, z: 1 },
  rotation: { x: -Math.PI / 2, y: 0, z: 0 },
}

describe('buildConstructionDrawingSet', () => {
  it('creates one front-view sheet for every wall and floor plane', () => {
    const drawingSet = buildConstructionDrawingSet(project([wallComponent('component-a'), floorComponent('component-b')]), { generatedAt: '2026-07-07T00:00:00.000Z' })

    expect(drawingSet.sheets.map((sheet) => sheet.planeId)).toEqual(['wall-1', 'wall-2', 'floor-1'])
    expect(drawingSet.sheets.find((sheet) => sheet.planeId === 'wall-1')?.components).toHaveLength(1)
    expect(drawingSet.sheets.find((sheet) => sheet.planeId === 'wall-2')?.components).toHaveLength(0)
    expect(drawingSet.sheets.find((sheet) => sheet.planeId === 'floor-1')?.components).toHaveLength(1)
  })

  it('marks wall component position, occupied bounds, and drawing dimensions in plane coordinates', () => {
    const drawingSet = buildConstructionDrawingSet(project([wallComponent('component-a')]))
    const mark = drawingSet.sheets.find((sheet) => sheet.planeId === 'wall-1')?.components[0]

    expect(mark).toMatchObject({
      code: 'C01',
      center: { x: 0.6, y: 1 },
      bounds: {
        minX: 0.4,
        maxX: 0.8,
        minY: 0.85,
        maxY: 1.15,
      },
      drawingSize: {
        length: 0.4,
        width: 0.3,
      },
      size: { x: 0.4, y: 0.3, z: 0.2 },
    })
  })

  it('uses floor depth as the second drawing dimension', () => {
    const drawingSet = buildConstructionDrawingSet(project([floorComponent('component-b')]))
    const mark = drawingSet.sheets.find((sheet) => sheet.planeId === 'floor-1')?.components[0]

    expect(mark).toMatchObject({
      center: { x: 1.4, y: 1.8 },
      drawingSize: {
        length: 0.4,
        width: 0.4,
      },
      size: { x: 0.4, y: 0.24, z: 0.4 },
    })
  })

  it('summarizes bill of materials with known prices and pending quote items', () => {
    const drawingSet = buildConstructionDrawingSet(project([wallComponent('component-a'), wallComponent('component-b'), unknownComponent('component-c')]))

    expect(drawingSet.billOfMaterials.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'cat-shelf',
          quantity: 2,
          unitPrice: 299,
          subtotal: 598,
          componentCodes: ['C01', 'C02'],
        }),
        expect.objectContaining({
          kind: 'custom-kind',
          quantity: 1,
          unitPrice: undefined,
          subtotal: undefined,
          componentCodes: ['C03'],
        }),
      ]),
    )
    expect(drawingSet.billOfMaterials.knownTotal).toBe(598)
    expect(drawingSet.billOfMaterials.pendingQuoteComponentCount).toBe(1)
    expect(drawingSet.warnings.some((warning) => warning.reason === 'missing-catalog')).toBe(true)
  })

  it('warns about components that cannot be placed on a construction sheet', () => {
    const drawingSet = buildConstructionDrawingSet(project([freeComponent('component-free'), missingPlaneComponent('component-missing')]))

    expect(drawingSet.warnings.map((warning) => warning.reason)).toEqual(['unbound-component', 'missing-plane'])
    expect(drawingSet.billOfMaterials.items).toHaveLength(0)
  })

  it('adds forbidden zones to their target sheet in drawing coordinates', () => {
    const drawingSet = buildConstructionDrawingSet({
      ...project([]),
      forbiddenZones: [
        {
          id: 'zone-1',
          name: 'No shelf',
          planeId: 'wall-1',
          shape: 'polygon',
          points: [
            { x: -0.3, y: -0.2 },
            { x: 0.3, y: -0.2 },
            { x: 0.3, y: 0.2 },
            { x: -0.3, y: 0.2 },
          ],
        },
      ],
    })

    expect(drawingSet.sheets.find((sheet) => sheet.planeId === 'wall-1')?.forbiddenZones[0]).toMatchObject({
      bounds: { minX: 0.7, maxX: 1.3, minY: 0.8, maxY: 1.2 },
      points: [
        { x: 0.7, y: 0.8 },
        { x: 1.3, y: 0.8 },
        { x: 1.3, y: 1.2 },
        { x: 0.7, y: 1.2 },
      ],
    })
  })
})

describe('construction drawing formatters', () => {
  it('formats dimensions and prices for labels', () => {
    expect(formatConstructionDimension(0.345)).toBe('35 cm')
    expect(formatConstructionDimension(1.2)).toBe('1.20 m')
    expect(formatPrice(1234)).toBe('¥1,234')
    expect(formatPrice(undefined)).toBe('待报价')
  })
})

function project(components: SceneComponent[]): Project {
  return {
    id: 'project-1',
    name: 'Test Project',
    sourceImage: null,
    corners: [],
    ruler: null,
    perspectiveGuides: [],
    perspectiveCalibration: null,
    sceneCamera: null,
    polygons: [],
    planes: [wallPlane, sideWallPlane, floorPlane],
    forbiddenZones: [],
    components,
    settings: {
      showFloor: true,
      sketchBackground: true,
      showMeasurements: true,
    },
  }
}

function wallComponent(id: string): SceneComponent {
  return {
    id,
    kind: 'cat-shelf',
    name: id,
    targetPlaneId: 'wall-1',
    placement: {
      mode: 'wall',
      targetPlaneId: 'wall-1',
      anchor: { x: -0.4, y: 1, z: 0.05 },
      normal: { x: 0, y: 0, z: 1 },
    },
    position: { x: -0.4, y: 1, z: 0.15 },
    rotation: { x: 0, y: 0, z: 0 },
    size: { x: 0.4, y: 0.3, z: 0.2 },
  }
}

function floorComponent(id: string): SceneComponent {
  return {
    id,
    kind: 'cat-bed',
    name: id,
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
}

function unknownComponent(id: string): SceneComponent {
  return {
    ...wallComponent(id),
    kind: 'custom-kind',
  }
}

function freeComponent(id: string): SceneComponent {
  return {
    ...wallComponent(id),
    placement: { mode: 'free' },
    targetPlaneId: undefined,
  }
}

function missingPlaneComponent(id: string): SceneComponent {
  return {
    ...wallComponent(id),
    placement: {
      mode: 'wall',
      targetPlaneId: 'missing-wall',
    },
    targetPlaneId: 'missing-wall',
  }
}
