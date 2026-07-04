import { beforeEach, describe, expect, it } from 'vitest'
import type { Project } from '../domain/scene/types'
import { useEditorStore } from './editorStore'

const baseProject: Project = {
  id: 'test-project',
  name: 'Test Project',
  sourceImage: null,
  corners: [],
  ruler: null,
  perspectiveGuides: [],
  perspectiveCalibration: null,
  sceneCamera: null,
  polygons: [],
  planes: [
    {
      id: 'wall-1',
      name: 'Wall',
      type: 'wall',
      width: 3,
      height: 2.4,
      textureEnabled: false,
      uvMode: 'auto',
      position: { x: 0, y: 1.2, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'floor-1',
      name: 'Floor',
      type: 'floor',
      width: 3,
      height: 2,
      textureEnabled: false,
      uvMode: 'auto',
      position: { x: 0, y: 0, z: 1 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    },
  ],
  components: [],
  settings: {
    showFloor: true,
    sketchBackground: true,
  },
}

describe('editorStore component placement requests', () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: { ...baseProject, components: [] },
      selectedId: null,
      mode: 'geometry-built',
      transformMode: 'select',
      pendingComponentPlacement: null,
      history: [],
      future: [],
      geometryErrors: [],
    })
  })

  it('stores and consumes pending component placement requests', () => {
    useEditorStore.getState().requestComponentPlacement('cat-shelf', { x: 42, y: 24 })

    const pending = useEditorStore.getState().pendingComponentPlacement
    expect(pending).toMatchObject({
      kind: 'cat-shelf',
      clientPoint: { x: 42, y: 24 },
    })

    useEditorStore.getState().consumeComponentPlacement('different-id')
    expect(useEditorStore.getState().pendingComponentPlacement).toBe(pending)

    useEditorStore.getState().consumeComponentPlacement(pending!.id)
    expect(useEditorStore.getState().pendingComponentPlacement).toBeNull()
  })

  it('uses a matching raycast hit when adding a wall component', () => {
    useEditorStore.getState().addComponent('cat-shelf', {
      planeId: 'wall-1',
      planeType: 'wall',
      point: { x: 0.4, y: 1.3, z: 0.02 },
      normal: { x: 0, y: 0, z: 1 },
      surface: 'front',
    })

    const component = useEditorStore.getState().project.components[0]
    expect(component.targetPlaneId).toBe('wall-1')
    expect(component.position).toEqual({ x: 0.4, y: 1.3, z: 0.11 })
    expect(component.placement).toMatchObject({
      mode: 'wall',
      targetPlaneId: 'wall-1',
      anchor: { x: 0.4, y: 1.3, z: 0.02 },
      normal: { x: 0, y: 0, z: 1 },
    })
  })

  it('uses a matching raycast hit when adding a floor component', () => {
    useEditorStore.getState().addComponent('cat-bed', {
      planeId: 'floor-1',
      planeType: 'floor',
      point: { x: 0.4, y: 0, z: 0.7 },
      normal: { x: 0, y: 1, z: 0 },
      surface: 'top',
    })

    const component = useEditorStore.getState().project.components[0]
    expect(component.targetPlaneId).toBe('floor-1')
    expect(component.position).toEqual({ x: 0.4, y: 0.12, z: 0.7 })
    expect(component.placement).toMatchObject({
      mode: 'floor',
      targetPlaneId: 'floor-1',
      anchor: { x: 0.4, y: 0, z: 0.7 },
      normal: { x: 0, y: 1, z: 0 },
    })
  })

  it('clamps wall component drops to the target wall bounds', () => {
    useEditorStore.getState().addComponent('cat-shelf', {
      planeId: 'wall-1',
      planeType: 'wall',
      point: { x: 2, y: 3, z: 0.02 },
      normal: { x: 0, y: 0, z: 1 },
      surface: 'front',
    })

    const component = useEditorStore.getState().project.components[0]
    expect(component.position).toEqual({ x: 1.14, y: 2.23, z: 0.11 })
    expect(component.placement).toMatchObject({
      mode: 'wall',
      targetPlaneId: 'wall-1',
      anchor: { x: 1.14, y: 2.23, z: 0.02 },
    })
  })

  it('clamps floor component drops to the target floor footprint', () => {
    useEditorStore.getState().addComponent('cat-bed', {
      planeId: 'floor-1',
      planeType: 'floor',
      point: { x: 2, y: 0, z: -0.3 },
      normal: { x: 0, y: 1, z: 0 },
      surface: 'top',
    })

    const component = useEditorStore.getState().project.components[0]
    expect(component.position).toEqual({ x: 1.19, y: 0.12, z: 0.24 })
    expect(component.placement).toMatchObject({
      mode: 'floor',
      targetPlaneId: 'floor-1',
      anchor: { x: 1.19, y: 0, z: 0.24 },
    })
  })

  it('keeps unknown free components unbound when dropped on a plane', () => {
    useEditorStore.getState().addComponent('free-prop', {
      planeId: 'wall-1',
      planeType: 'wall',
      point: { x: 0.4, y: 1.3, z: 0.02 },
      normal: { x: 0, y: 0, z: 1 },
      surface: 'front',
    })

    const component = useEditorStore.getState().project.components[0]
    expect(component.targetPlaneId).toBeUndefined()
    expect(component.position).toEqual({ x: 0.4, y: 1.3, z: 0.1 })
    expect(component.placement).toEqual({
      mode: 'free',
      anchor: { x: 0.4, y: 1.3, z: 0.02 },
      normal: { x: 0, y: 0, z: 1 },
    })
  })

  it('falls back instead of storing a mismatched hit', () => {
    useEditorStore.getState().addComponent('cat-shelf', {
      planeId: 'floor-1',
      planeType: 'floor',
      point: { x: 0.4, y: 0, z: 0.7 },
      normal: { x: 0, y: 1, z: 0 },
      surface: 'top',
    })

    const component = useEditorStore.getState().project.components[0]
    expect(component.targetPlaneId).toBe('wall-1')
    expect(component.position).toEqual({ x: -0.84, y: 0.25, z: 0.08 })
    expect(component.placement).toEqual({
      mode: 'wall',
      targetPlaneId: 'wall-1',
    })
  })
})
