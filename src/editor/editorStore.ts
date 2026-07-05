import { create } from 'zustand'
import { buildPlanes } from '../domain/geometry/buildPlanes'
import { buildPolygons } from '../domain/geometry/buildPolygons'
import { buildPerspectiveRoom } from '../domain/geometry/perspective'
import { buildWallTemplatePlanes } from '../domain/geometry/wallTemplates'
import { createDefaultComponentParams, getComponentCatalogItem, getComponentLabel } from '../domain/scene/componentCatalog'
import { buildComponentPlacement, constrainComponentTransform } from '../domain/scene/componentPlacement'
import type { ComponentPlacementFeedback, ComponentPlacementFeedbackReason, ComponentPlacementHit, ComponentPlacementMode, ComponentPlacementWarning, CornerKind, CornerPoint, EditorMode, HistoryEntry, PendingComponentPlacement, PerspectiveAxis, PerspectiveGuideLine, PlaneSpec, PlaneType, Project, RulerPoint, SceneComponent, SceneComponentKind, SourceImage, TransformMode, Vec2, WallTemplateKind } from '../domain/scene/types'

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
  componentPlacementFeedback: ComponentPlacementFeedback | null
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
  clearComponentPlacementFeedback: () => void
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
  componentPlacementFeedback: null,
  activePerspectiveAxis: 'left',
  setSourceImage: (sourceImage) =>
    set((state) => ({
      project: { ...state.project, sourceImage, corners: [], ruler: null, perspectiveGuides: [], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], components: [] },
      mode: 'marking-perspective',
      selectedId: null,
      transformMode: 'select',
      geometryErrors: [],
      pendingComponentPlacement: null,
      componentPlacementFeedback: null,
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
      componentPlacementFeedback: null,
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
      componentPlacementFeedback: null,
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
      componentPlacementFeedback: null,
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
      componentPlacementFeedback: null,
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
      componentPlacementFeedback: null,
    }),
  consumeComponentPlacement: (id) =>
    set((state) => (state.pendingComponentPlacement?.id === id ? { pendingComponentPlacement: null } : state)),
  clearComponentPlacementFeedback: () => set({ componentPlacementFeedback: null }),
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

      if (!placementResult.canPlace) {
        return {
          componentPlacementFeedback: buildPlacementFeedback({
            project: state.project,
            kind,
            requestedPlacement: placementMode,
            hit,
            level: 'error',
            reason: normalizePlacementFailureReason(placementResult.reason),
            warnings: placementResult.warnings,
          }),
        }
      }

      const componentId = `component-${Date.now()}`
      const placementFeedback = buildPlacementFeedback({
        project: state.project,
        kind,
        requestedPlacement: placementMode,
        hit,
        targetPlaneId: placementResult.placement.targetPlaneId,
        level: placementResult.warnings.length > 0 ? 'warning' : 'info',
        reason: placementResult.warnings.length > 0 ? 'placement-adjusted' : 'placed',
        warnings: placementResult.warnings,
      })

      return {
        project: {
          ...state.project,
          components: [
            ...state.project.components,
            {
              id: componentId,
              kind,
              name: getComponentLabel(kind),
              targetPlaneId: placementResult.placement.targetPlaneId,
              placement: placementResult.placement,
              position: placementResult.position,
              rotation: placementResult.rotation,
              scale: { x: 1, y: 1, z: 1 },
              size,
              material: { color: catalogItem?.fallbackColor },
              params: createDefaultComponentParams(kind),
            },
          ],
        },
        selectedId: componentId,
        mode: 'dragging-components',
        componentPlacementFeedback: placementFeedback,
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

function normalizePlacementFailureReason(reason: string): ComponentPlacementFeedbackReason {
  if (reason === 'missing-hit' || reason === 'incompatible-surface' || reason === 'missing-plane') return reason
  return 'missing-hit'
}

function buildPlacementFeedback({
  project,
  kind,
  requestedPlacement,
  hit,
  targetPlaneId,
  level,
  reason,
  warnings,
}: {
  project: Project
  kind: SceneComponentKind
  requestedPlacement: ComponentPlacementMode
  hit: ComponentPlacementHit | null
  targetPlaneId?: string
  level: ComponentPlacementFeedback['level']
  reason: ComponentPlacementFeedbackReason
  warnings: ComponentPlacementWarning[]
}): ComponentPlacementFeedback {
  const componentLabel = getComponentLabel(kind)
  const requestedLabel = placementModeLabel(requestedPlacement)
  const hitLabel = hit ? planeTypeLabel(hit.planeType) : undefined
  const targetPlane = targetPlaneId ? project.planes.find((plane) => plane.id === targetPlaneId) : undefined
  const targetLabel = targetPlane?.name ?? targetPlaneId
  const details = buildPlacementDetails(reason, requestedLabel, hitLabel, targetLabel, warnings)

  return {
    id: `component-placement-feedback-${Date.now()}`,
    level,
    reason,
    componentKind: kind,
    requestedPlacement,
    hitPlaneType: hit?.planeType,
    targetPlaneId,
    warnings,
    title: placementFeedbackTitle(level),
    message: placementFeedbackMessage(reason, componentLabel, requestedLabel, hitLabel, targetLabel),
    details: details.length > 0 ? details : undefined,
  }
}

function placementFeedbackTitle(level: ComponentPlacementFeedback['level']) {
  if (level === 'error') return '无法放置组件'
  if (level === 'warning') return '位置已调整'
  return '组件已放置'
}

function placementFeedbackMessage(reason: ComponentPlacementFeedbackReason, componentLabel: string, requestedLabel: string, hitLabel?: string, targetLabel?: string) {
  if (reason === 'missing-hit') return `${componentLabel} 没有命中可放置的模型表面，未创建组件。`
  if (reason === 'incompatible-surface') return `${componentLabel} 需要放在${requestedLabel}，当前命中的是${hitLabel ?? '不支持的表面'}，未创建组件。`
  if (reason === 'missing-plane') return `${componentLabel} 命中的 plane 不在当前场景中，未创建组件。`
  if (reason === 'placement-adjusted') return `${componentLabel} 已放置到${targetLabel ?? requestedLabel}，并按边界自动调整。`
  return `${componentLabel} 已放置到${targetLabel ?? requestedLabel}。`
}

function buildPlacementDetails(reason: ComponentPlacementFeedbackReason, requestedLabel: string, hitLabel: string | undefined, targetLabel: string | undefined, warnings: ComponentPlacementWarning[]) {
  const details: string[] = []
  if (targetLabel) details.push(`绑定对象：${targetLabel}`)
  if (reason === 'incompatible-surface') {
    details.push(`需要：${requestedLabel}`)
    if (hitLabel) details.push(`命中：${hitLabel}`)
  }
  details.push(...warnings.map(placementWarningMessage))
  return details
}

function placementWarningMessage(warning: ComponentPlacementWarning) {
  if (warning === 'component-anchor-clamped') return '落点超出可用边界，已贴到最近的有效位置。'
  if (warning === 'component-width-exceeds-plane') return '组件宽度超过绑定平面，请缩小组件或放大平面。'
  if (warning === 'component-height-exceeds-plane') return '组件高度超过绑定平面，请缩小组件或放大平面。'
  return '组件深度超过绑定平面，请缩小组件或放大平面。'
}

function placementModeLabel(mode: ComponentPlacementMode) {
  if (mode === 'wall') return '墙面'
  if (mode === 'floor') return '地面'
  return '自由空间'
}

function planeTypeLabel(type: PlaneType) {
  return type === 'wall' ? '墙面' : '地面'
}
