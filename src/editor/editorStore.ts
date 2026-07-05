import { create } from 'zustand'
import { buildPlanes } from '../domain/geometry/buildPlanes'
import { buildPolygons } from '../domain/geometry/buildPolygons'
import { buildPerspectiveRoom } from '../domain/geometry/perspective'
import { buildWallTemplatePlanes } from '../domain/geometry/wallTemplates'
import { createDefaultComponentParams, getComponentCatalogItem, getComponentLabel } from '../domain/scene/componentCatalog'
import { buildComponentPlacement, constrainComponentTransform } from '../domain/scene/componentPlacement'
import type { ComponentPlacementHit, ComponentPlacementMode, CornerKind, CornerPoint, EditorMode, HistoryEntry, PendingComponentPlacement, PerspectiveAxis, PerspectiveGuideLine, PlaneSpec, Project, RulerPoint, SceneComponent, SceneComponentKind, SourceImage, TransformMode, Vec2, WallTemplateKind } from '../domain/scene/types'

type EditorStore = {
  project: Project
  mode: EditorMode
  selectedId: string | null
  activeCategory: string
  activePerspectiveAxis: PerspectiveAxis
  transformMode: TransformMode
  history: HistoryEntry[]
  future: HistoryEntry[]
  geometryErrors: string[]
  pendingComponentPlacement: PendingComponentPlacement | null
  setSourceImage: (sourceImage: SourceImage) => void
  clearSourceImage: () => void
  setMode: (mode: EditorMode) => void
  addCorner: (point: Vec2, kind?: CornerKind) => void
  deleteCorner: (id: string) => void
  moveCorner: (id: string, to: Vec2) => void
  createPerspectiveGuide: (axis: PerspectiveAxis) => void
  addPerspectiveGuide: (start: Vec2, end: Vec2) => void
  movePerspectiveGuidePoint: (id: string, pointIndex: 0 | 1, to: Vec2) => void
  deletePerspectiveGuide: (id: string) => void
  setPerspectiveAxis: (axis: PerspectiveAxis) => void
  createRuler: () => void
  addRulerPoint: (point: Vec2) => void
  moveRulerPoint: (id: string, to: Vec2) => void
  updateRulerLength: (lengthCm: number) => void
  undo: () => void
  redo: () => void
  resetCorners: () => void
  buildGeometry: () => void
  applyWallTemplate: (kind: WallTemplateKind) => void
  toggleFloor: (value: boolean) => void
  setTransformMode: (mode: TransformMode) => void
  updatePlaneSize: (id: string, field: 'width' | 'height', value: number) => void
  updatePlaneTextureMapping: (id: string, enabled: boolean) => void
  updatePlaneTransform: (id: string, patch: Partial<Pick<PlaneSpec, 'position' | 'rotation'>>) => void
  updateComponentTransform: (id: string, patch: Partial<Pick<SceneComponent, 'position' | 'rotation' | 'scale' | 'size' | 'material' | 'params'>>) => void
  selectPlane: (id: string | null) => void
  selectSceneObject: (id: string | null) => void
  deleteSelectedSceneObject: () => void
  setActiveCategory: (category: string) => void
  requestComponentPlacement: (kind: SceneComponentKind, clientPoint: Vec2 | null) => void
  consumeComponentPlacement: (id: string) => void
  addComponent: (kind: SceneComponentKind, hit?: ComponentPlacementHit | null) => void
}

const initialProject: Project = {
  id: 'local-draft',
  name: '猫墙编辑器',
  sourceImage: null,
  corners: [],
  ruler: null,
  perspectiveGuides: [],
  perspectiveCalibration: null,
  sceneCamera: null,
  polygons: [],
  planes: [],
  components: [],
  settings: {
    showFloor: true,
    sketchBackground: true,
  },
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: initialProject,
  mode: 'empty',
  selectedId: null,
  activeCategory: 'wall',
  transformMode: 'select',
  history: [],
  future: [],
  geometryErrors: [],
  pendingComponentPlacement: null,
  activePerspectiveAxis: 'left',
  setSourceImage: (sourceImage) =>
    set((state) => ({
      project: { ...state.project, sourceImage, corners: [], ruler: null, perspectiveGuides: [], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], components: [] },
      mode: 'marking-perspective',
      selectedId: null,
      transformMode: 'select',
      geometryErrors: [],
      pendingComponentPlacement: null,
      history: [],
      future: [],
    })),
  clearSourceImage: () =>
    set((state) => ({
      project: { ...state.project, sourceImage: null, corners: [], ruler: null, perspectiveGuides: [], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], components: [] },
      mode: 'empty',
      selectedId: null,
      transformMode: 'select',
      geometryErrors: [],
      pendingComponentPlacement: null,
      history: [],
      future: [],
    })),
  setMode: (mode) => set({ mode }),
  addCorner: (point, kind = 'wall') => {
    const corner: CornerPoint = { id: `corner-${Date.now()}-${Math.round(point.x)}-${Math.round(point.y)}`, x: point.x, y: point.y, kind }
    set((state) => ({
      project: { ...state.project, corners: [...state.project.corners, corner], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [] },
      mode: 'marking-corners',
      history: [...state.history, { type: 'add-corner', payload: corner }],
      future: [],
      geometryErrors: [],
    }))
  },
  deleteCorner: (id) => {
    const { project } = get()
    const index = project.corners.findIndex((corner) => corner.id === id)
    const corner = project.corners[index]
    if (!corner) return

    set((state) => ({
      project: {
        ...state.project,
        corners: state.project.corners.filter((item) => item.id !== id),
        perspectiveCalibration: null,
        sceneCamera: null,
        polygons: [],
        planes: [],
      },
      mode: state.project.sourceImage ? 'marking-corners' : 'empty',
      selectedId: null,
      history: [...state.history, { type: 'delete-corner', payload: { corner, index } }],
      future: [],
      geometryErrors: [],
    }))
  },
  moveCorner: (id, to) => {
    const from = get().project.corners.find((corner) => corner.id === id)
    if (!from) return
    set((state) => ({
      project: {
        ...state.project,
        corners: state.project.corners.map((corner) => (corner.id === id ? { ...corner, ...to } : corner)),
        perspectiveCalibration: null,
        sceneCamera: null,
        polygons: [],
        planes: [],
      },
      history: [...state.history, { type: 'move-corner', payload: { id, from: { x: from.x, y: from.y }, to } }],
      future: [],
      geometryErrors: [],
    }))
  },
  createPerspectiveGuide: (axis) => {
    const { project } = get()
    if (!project.sourceImage) return
    const { width, height } = project.sourceImage
    const offset = project.perspectiveGuides.filter((guide) => guide.axis === axis).length * 0.06
    const y = height * (axis === 'vertical' ? 0.38 + offset : axis === 'left' ? 0.42 + offset : 0.62 - offset)
    const x = width * (axis === 'vertical' ? 0.52 + offset : 0.5)
    const points: [Vec2, Vec2] =
      axis === 'vertical'
        ? [
            { x, y: height * 0.14 },
            { x: x + width * 0.012, y: height * 0.86 },
          ]
        : [
            { x: width * 0.2, y },
            { x: width * 0.82, y: axis === 'left' ? y - height * 0.09 : y + height * 0.09 },
          ]

    const guide: PerspectiveGuideLine = {
      id: `perspective-${axis}-${Date.now()}`,
      axis,
      points,
    }
    set((state) => ({
      project: { ...state.project, perspectiveGuides: [...state.project.perspectiveGuides, guide], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [] },
      mode: 'marking-perspective',
      activePerspectiveAxis: axis,
      future: [],
      geometryErrors: [],
    }))
  },
  addPerspectiveGuide: (start, end) =>
    set((state) => {
      if (!state.project.sourceImage) return state
      const guide: PerspectiveGuideLine = {
        id: `perspective-${state.activePerspectiveAxis}-${Date.now()}`,
        axis: state.activePerspectiveAxis,
        points: [start, end],
      }
      return {
        project: { ...state.project, perspectiveGuides: [...state.project.perspectiveGuides, guide], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [] },
        mode: 'marking-perspective',
        future: [],
        geometryErrors: [],
      }
    }),
  movePerspectiveGuidePoint: (id, pointIndex, to) =>
    set((state) => ({
      project: {
        ...state.project,
        perspectiveGuides: state.project.perspectiveGuides.map((guide) => {
          if (guide.id !== id) return guide
          const points: [Vec2, Vec2] = [...guide.points] as [Vec2, Vec2]
          points[pointIndex] = to
          return { ...guide, points }
        }),
        perspectiveCalibration: null,
        sceneCamera: null,
        polygons: [],
        planes: [],
      },
      mode: 'marking-perspective',
      geometryErrors: [],
    })),
  deletePerspectiveGuide: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        perspectiveGuides: state.project.perspectiveGuides.filter((guide) => guide.id !== id),
        perspectiveCalibration: null,
        sceneCamera: null,
        polygons: [],
        planes: [],
      },
      mode: 'marking-perspective',
      selectedId: null,
      geometryErrors: [],
    })),
  setPerspectiveAxis: (axis) => set({ activePerspectiveAxis: axis, mode: 'marking-perspective' }),
  createRuler: () => {
    const { project } = get()
    if (!project.sourceImage) return
    const { width, height } = project.sourceImage
    const y = height * 0.72
    const left = width * 0.36
    const right = width * 0.64
    const points: RulerPoint[] = [
      { id: `ruler-a-${Date.now()}`, x: left, y },
      { id: `ruler-b-${Date.now()}`, x: right, y },
    ]

    set((state) => ({
      project: {
        ...state.project,
        ruler: {
          points,
          lengthCm: state.project.ruler?.lengthCm ?? 100,
        },
      },
      mode: 'marking-ruler',
    }))
  },
  addRulerPoint: (point) =>
    set((state) => {
      const current = state.project.ruler
      const points = current?.points.length === 1 ? [...current.points, { ...point, id: `ruler-b-${Date.now()}` }] : [{ ...point, id: `ruler-a-${Date.now()}` }]
      return {
        project: {
          ...state.project,
          ruler: {
            points,
            lengthCm: current?.lengthCm ?? 100,
          },
        },
        mode: 'marking-ruler',
      }
    }),
  moveRulerPoint: (id, to) =>
    set((state) => ({
      project: {
        ...state.project,
        ruler: state.project.ruler
          ? {
              ...state.project.ruler,
              points: state.project.ruler.points.map((point) => (point.id === id ? { ...point, ...to } : point)),
            }
          : null,
      },
    })),
  updateRulerLength: (lengthCm) =>
    set((state) => ({
      project: state.project.ruler
        ? {
            ...state.project,
            ruler: {
              ...state.project.ruler,
              lengthCm: Math.max(1, Math.round(lengthCm)),
            },
          }
        : state.project,
    })),
  undo: () => {
    const { history } = get()
    const entry = history[history.length - 1]
    if (!entry) return
    set((state) => ({
      ...applyHistoryEntry(state, entry, 'undo'),
      history: state.history.slice(0, -1),
      future: [entry, ...state.future],
    }))
  },
  redo: () => {
    const { future } = get()
    const entry = future[0]
    if (!entry) return
    set((state) => ({
      ...applyHistoryEntry(state, entry, 'redo'),
      history: [...state.history, entry],
      future: state.future.slice(1),
    }))
  },
  resetCorners: () =>
    set((state) => ({
      project: { ...state.project, corners: [], perspectiveGuides: [], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], components: [] },
      mode: state.project.sourceImage ? 'marking-perspective' : 'empty',
      selectedId: null,
      history: [],
      future: [],
      geometryErrors: [],
    })),
  buildGeometry: () => {
    const { project, selectedId, mode, geometryErrors } = get()
    const perspectiveResult = buildPerspectiveRoom(project.sourceImage, project.perspectiveGuides, project.ruler, true, project.planes)
    const result = perspectiveResult.layout ? { polygons: [], errors: perspectiveResult.errors } : buildPolygons(project.corners, project.sourceImage)
    const planes = perspectiveResult.layout?.planes ?? buildPlanes(result.polygons, project.sourceImage, true, project.planes)
    const nextMode = planes.length ? 'editing-planes' : project.sourceImage ? 'marking-perspective' : 'empty'
    const nextSelectedId = planes.find((plane) => plane.type === 'wall')?.id ?? null
    set({
      project: {
        ...project,
        polygons: result.polygons,
        planes,
        perspectiveCalibration: perspectiveResult.layout?.calibration ?? null,
        sceneCamera: perspectiveResult.layout?.camera ?? null,
        settings: { ...project.settings, showFloor: true },
      },
      mode: nextMode,
      selectedId: nextSelectedId,
      geometryErrors: result.errors,
      history: [
        ...get().history,
        {
          type: 'build-geometry',
          payload: {
            from: {
              polygons: project.polygons,
              planes: project.planes,
              perspectiveCalibration: project.perspectiveCalibration,
              sceneCamera: project.sceneCamera,
              selectedId,
              mode,
              geometryErrors,
            },
            to: {
              polygons: result.polygons,
              planes,
              perspectiveCalibration: perspectiveResult.layout?.calibration ?? null,
              sceneCamera: perspectiveResult.layout?.camera ?? null,
              selectedId: nextSelectedId,
              mode: nextMode,
              geometryErrors: result.errors,
            },
          },
        },
      ],
      future: [],
    })
  },
  applyWallTemplate: (kind) => {
    const { project, selectedId, mode, geometryErrors } = get()
    const planes = buildWallTemplatePlanes(kind, project.sourceImage, true, project.planes)
    const nextSelectedId = planes.find((plane) => plane.type === 'wall')?.id ?? null
    const nextMode: EditorMode = 'editing-planes'

    set({
      project: {
        ...project,
        polygons: [],
        planes,
        perspectiveCalibration: null,
        sceneCamera: null,
        settings: { ...project.settings, showFloor: true },
      },
      mode: nextMode,
      selectedId: nextSelectedId,
      geometryErrors: [],
      history: [
        ...get().history,
        {
          type: 'build-geometry',
          payload: {
            from: {
              polygons: project.polygons,
              planes: project.planes,
              perspectiveCalibration: project.perspectiveCalibration,
              sceneCamera: project.sceneCamera,
              selectedId,
              mode,
              geometryErrors,
            },
            to: {
              polygons: [],
              planes,
              perspectiveCalibration: null,
              sceneCamera: null,
              selectedId: nextSelectedId,
              mode: nextMode,
              geometryErrors: [],
            },
          },
        },
      ],
      future: [],
    })
  },
  toggleFloor: (value) => {
    const previous = get().project.settings.showFloor
    set((state) => {
      const project = {
        ...state.project,
        settings: { ...state.project.settings, showFloor: value },
      }
      return {
        project: {
          ...project,
          planes: project.sceneCamera ? buildPerspectiveRoom(project.sourceImage, project.perspectiveGuides, project.ruler, value, project.planes).layout?.planes ?? project.planes : buildPlanes(project.polygons, project.sourceImage, value, project.planes),
        },
        mode: project.polygons.length ? 'floor-optional' : state.mode,
        history: [...state.history, { type: 'toggle-floor', payload: { from: previous, to: value } }],
        future: [],
      }
    })
  },
  updatePlaneSize: (id, field, value) =>
    set((state) => {
      const plane = state.project.planes.find((item) => item.id === id)
      if (!plane) return state
      return {
        project: {
          ...state.project,
          planes: state.project.planes.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
        },
        history: [...state.history, { type: 'update-plane', payload: { id, from: { [field]: plane[field] }, to: { [field]: value } } }],
        future: [],
      }
    }),
  updatePlaneTextureMapping: (id, enabled) =>
    set((state) => {
      const plane = state.project.planes.find((item) => item.id === id)
      if (!plane) return state
      return {
        project: {
          ...state.project,
          planes: state.project.planes.map((item) => (item.id === id ? { ...item, textureEnabled: enabled } : item)),
        },
        history: [...state.history, { type: 'update-plane', payload: { id, from: { textureEnabled: plane.textureEnabled }, to: { textureEnabled: enabled } } }],
        future: [],
      }
    }),
  selectPlane: (id) => set({ selectedId: id }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  requestComponentPlacement: (kind, clientPoint) =>
    set({
      pendingComponentPlacement: {
        id: `placement-${Date.now()}`,
        kind,
        clientPoint,
      },
    }),
  consumeComponentPlacement: (id) =>
    set((state) => (state.pendingComponentPlacement?.id === id ? { pendingComponentPlacement: null } : state)),
  addComponent: (kind, hit = null) =>
    set((state) => {
      const catalogItem = getComponentCatalogItem(kind)
      const placementMode = catalogItem?.placement ?? 'free'
      const size = catalogItem?.defaultSize ?? { x: 0.46, y: 0.28, z: 0.14 }
      const defaultRotation = catalogItem?.defaultRotation ?? { x: 0, y: 0, z: 0 }
      const placementResult = buildComponentPlacement(
        {
          placement: placementMode,
          defaultSize: size,
          defaultRotation,
        },
        hit,
        state.project.planes,
      )
      const targetPlaneId = placementResult.canPlace
        ? placementResult.placement.targetPlaneId
        : findFallbackTargetPlaneId(state.project, state.selectedId, placementMode)
      const offset = state.project.components.length
      const fallbackPosition = { x: (offset % 5) * 0.42 - 0.84, y: 0.25 + (offset % 2) * 0.18, z: 0.08 }

      return {
        project: {
          ...state.project,
          components: [
            ...state.project.components,
            {
              id: `component-${Date.now()}`,
              kind,
              name: getComponentLabel(kind),
              targetPlaneId,
              placement: placementResult.canPlace ? placementResult.placement : buildFallbackPlacement(placementMode, targetPlaneId),
              position: placementResult.canPlace ? placementResult.position : fallbackPosition,
              rotation: placementResult.canPlace ? placementResult.rotation : defaultRotation,
              scale: { x: 1, y: 1, z: 1 },
              size,
              material: { color: catalogItem?.fallbackColor },
              params: createDefaultComponentParams(kind),
            },
          ],
        },
        mode: 'dragging-components',
      }
    }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  updatePlaneTransform: (id, patch) =>
    set((state) => {
      const plane = state.project.planes.find((item) => item.id === id)
      if (!plane) return state
      return {
        project: {
          ...state.project,
          planes: state.project.planes.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        },
        history: [...state.history, { type: 'update-plane', payload: { id, from: { position: plane.position, rotation: plane.rotation }, to: patch } }],
        future: [],
      }
    }),
  updateComponentTransform: (id, patch) =>
    set((state) => {
      const component = state.project.components.find((item) => item.id === id)
      if (!component) return state
      const catalogItem = getComponentCatalogItem(component.kind)
      const constrainedPatch = constrainComponentTransform(component, patch, state.project.planes, {
        defaultSize: catalogItem?.defaultSize,
        defaultRotation: catalogItem?.defaultRotation,
      })
      const from = pickComponentPatch(component, constrainedPatch)
      return {
        project: {
          ...state.project,
          components: state.project.components.map((item) => (item.id === id ? { ...item, ...constrainedPatch } : item)),
        },
        history: [...state.history, { type: 'update-component', payload: { id, from, to: constrainedPatch } }],
        future: [],
      }
    }),
  selectSceneObject: (id) => set({ selectedId: id }),
  deleteSelectedSceneObject: () =>
    set((state) => {
      if (!state.selectedId) return state

      const componentIndex = state.project.components.findIndex((item) => item.id === state.selectedId)
      const component = state.project.components[componentIndex]
      if (component) {
        return {
          project: {
            ...state.project,
            components: state.project.components.filter((item) => item.id !== component.id),
          },
          selectedId: null,
          transformMode: 'select',
          history: [...state.history, { type: 'delete-component', payload: { component, index: componentIndex, selectedId: state.selectedId } }],
          future: [],
        }
      }

      const planeIndex = state.project.planes.findIndex((item) => item.id === state.selectedId)
      const plane = state.project.planes[planeIndex]
      if (!plane || plane.type === 'floor') return state

      return {
        project: {
          ...state.project,
          planes: state.project.planes.filter((item) => item.id !== plane.id),
        },
        selectedId: null,
        transformMode: 'select',
        history: [...state.history, { type: 'delete-plane', payload: { plane, index: planeIndex, selectedId: state.selectedId } }],
        future: [],
      }
    }),
}))

function applyHistoryEntry(state: EditorStore, entry: HistoryEntry, direction: 'undo' | 'redo'): Partial<EditorStore> {
  const redo = direction === 'redo'
  if (entry.type === 'add-corner') {
    return {
      project: {
        ...state.project,
        corners: redo ? [...state.project.corners, entry.payload] : state.project.corners.filter((corner) => corner.id !== entry.payload.id),
        perspectiveCalibration: null,
        sceneCamera: null,
        polygons: [],
        planes: [],
      },
      geometryErrors: [],
    }
  }

  if (entry.type === 'delete-corner') {
    const corners = [...state.project.corners]
    if (!redo) {
      corners.splice(entry.payload.index, 0, entry.payload.corner)
    }

    return {
      project: {
        ...state.project,
        corners: redo ? state.project.corners.filter((corner) => corner.id !== entry.payload.corner.id) : corners,
        perspectiveCalibration: null,
        sceneCamera: null,
        polygons: [],
        planes: [],
      },
      geometryErrors: [],
    }
  }

  if (entry.type === 'move-corner') {
    const point = redo ? entry.payload.to : entry.payload.from
    return {
      project: {
        ...state.project,
        corners: state.project.corners.map((corner) => (corner.id === entry.payload.id ? { ...corner, ...point } : corner)),
        perspectiveCalibration: null,
        sceneCamera: null,
        polygons: [],
        planes: [],
      },
      geometryErrors: [],
    }
  }

  if (entry.type === 'toggle-floor') {
    const value = redo ? entry.payload.to : entry.payload.from
    const project = {
      ...state.project,
      settings: { ...state.project.settings, showFloor: value },
    }
    return {
      project: {
        ...project,
        planes: project.sceneCamera ? buildPerspectiveRoom(project.sourceImage, project.perspectiveGuides, project.ruler, value, project.planes).layout?.planes ?? project.planes : buildPlanes(project.polygons, project.sourceImage, value, project.planes),
      },
    }
  }

  if (entry.type === 'build-geometry') {
    const snapshot = redo ? entry.payload.to : entry.payload.from
    return {
      project: {
        ...state.project,
        polygons: snapshot.polygons,
        planes: snapshot.planes,
        perspectiveCalibration: snapshot.perspectiveCalibration,
        sceneCamera: snapshot.sceneCamera,
      },
      selectedId: snapshot.selectedId,
      mode: snapshot.mode,
      geometryErrors: snapshot.geometryErrors,
    }
  }

  if (entry.type === 'delete-plane') {
    const planes = [...state.project.planes]
    if (!redo) {
      planes.splice(entry.payload.index, 0, entry.payload.plane)
    }

    return {
      project: {
        ...state.project,
        planes: redo ? state.project.planes.filter((plane) => plane.id !== entry.payload.plane.id) : planes,
      },
      selectedId: redo ? null : entry.payload.selectedId,
      transformMode: 'select',
    }
  }

  if (entry.type === 'delete-component') {
    const components = [...state.project.components]
    if (!redo) {
      components.splice(entry.payload.index, 0, entry.payload.component)
    }

    return {
      project: {
        ...state.project,
        components: redo ? state.project.components.filter((component) => component.id !== entry.payload.component.id) : components,
      },
      selectedId: redo ? null : entry.payload.selectedId,
      transformMode: 'select',
    }
  }

  const value = redo ? entry.payload.to : entry.payload.from
  if (entry.type === 'update-component') {
    return {
      project: {
        ...state.project,
        components: state.project.components.map((component) => (component.id === entry.payload.id ? { ...component, ...value } : component)),
      },
    }
  }

  return {
    project: {
      ...state.project,
      planes: state.project.planes.map((plane) => (plane.id === entry.payload.id ? ({ ...plane, ...value } as PlaneSpec) : plane)),
    },
  }
}

function pickComponentPatch(component: SceneComponent, patch: Partial<SceneComponent>): Partial<SceneComponent> {
  const from: Partial<SceneComponent> = {}
  if ('position' in patch) from.position = component.position
  if ('rotation' in patch) from.rotation = component.rotation
  if ('scale' in patch) from.scale = component.scale
  if ('size' in patch) from.size = component.size
  if ('material' in patch) from.material = component.material
  if ('params' in patch) from.params = component.params
  if ('placement' in patch) from.placement = component.placement
  if ('targetPlaneId' in patch) from.targetPlaneId = component.targetPlaneId
  return from
}

function findFallbackTargetPlaneId(project: Project, selectedId: string | null, placementMode: ComponentPlacementMode) {
  if (placementMode === 'free') return undefined

  const selectedPlane = selectedId ? project.planes.find((plane) => plane.id === selectedId && plane.type === placementMode) : undefined
  return selectedPlane?.id ?? project.planes.find((plane) => plane.type === placementMode)?.id
}

function buildFallbackPlacement(mode: ComponentPlacementMode, targetPlaneId?: string) {
  return targetPlaneId
    ? {
        mode,
        targetPlaneId,
      }
    : {
        mode,
      }
}
