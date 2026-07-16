import { create } from 'zustand'
import { buildPlanes } from '../domain/geometry/buildPlanes'
import { buildPolygons } from '../domain/geometry/buildPolygons'
import { buildPerspectiveRoom } from '../domain/geometry/perspective'
import { reflowRoomPlanes } from '../domain/geometry/planeLayout'
import { buildWallTemplatePlanes } from '../domain/geometry/wallTemplates'
import { createDefaultComponentParams, getComponentCatalogItem, getComponentLabel } from '../domain/scene/componentCatalog'
import { buildComponentPlacement, constrainComponentTransform, projectBoundComponentOntoPlane, transformBoundComponentWithPlane } from '../domain/scene/componentPlacement'
import { resolveComponentSizeFromParams } from '../domain/scene/componentParamEffects'
import { buildForbiddenZoneFromDrag, filterForbiddenZonesForPlanes, findBlockingComponentForForbiddenZone, findBlockingForbiddenZone } from '../domain/scene/forbiddenZones'
import type { ComponentPlacementFeedback, ComponentPlacementFeedbackReason, ComponentPlacementHit, ComponentPlacementMode, ComponentPlacementWarning, CornerKind, CornerPoint, EditorMode, ForbiddenZone, ForbiddenZoneDrawMode, ForbiddenZoneShape, HistoryEntry, PendingComponentPlacement, PerspectiveAxis, PerspectiveGuideLine, PlaneSpec, PlaneType, Project, RulerPoint, SceneComponent, SceneComponentKind, SourceImage, TransformMode, Vec2, WallTemplateKind } from '../domain/scene/types'

type EditorStore = {
  project: Project
  mode: EditorMode
  selectedId: string | null
  activeCategory: string
  activePerspectiveAxis: PerspectiveAxis
  transformMode: TransformMode
  forbiddenZoneDrawMode: ForbiddenZoneDrawMode
  history: HistoryEntry[]
  future: HistoryEntry[]
  geometryErrors: string[]
  pendingComponentPlacement: PendingComponentPlacement | null
  componentPlacementFeedback: ComponentPlacementFeedback | null
  loadProject: (project: Project) => void
  setSourceImage: (sourceImage: SourceImage) => void
  clearSourceImage: () => void
  clearDraft: () => void
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
  toggleMeasurements: (value: boolean) => void
  setTransformMode: (mode: TransformMode) => void
  setForbiddenZoneDrawMode: (mode: ForbiddenZoneDrawMode) => void
  forbiddenZonesLocked: boolean
  setForbiddenZonesLocked: (locked: boolean) => void
  updatePlaneSize: (id: string, field: 'width' | 'height', value: number) => void
  updatePlaneTextureMapping: (id: string, enabled: boolean) => void
  updatePlaneTransform: (id: string, patch: Partial<Pick<PlaneSpec, 'position' | 'rotation'>>) => void
  updateComponentTransform: (id: string, patch: Partial<Pick<SceneComponent, 'position' | 'rotation' | 'scale' | 'size' | 'material' | 'params'>>) => void
  selectPlane: (id: string | null) => void
  selectSceneObject: (id: string | null) => void
  deleteSelectedSceneObject: () => void
  setActiveCategory: (category: string) => void
  addForbiddenZone: (planeId: string, shape: ForbiddenZoneShape, start: Vec2, end: Vec2) => void
  updateForbiddenZone: (id: string, zone: ForbiddenZone) => void
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
  forbiddenZones: [],
  components: [],
  settings: {
    showFloor: true,
    sketchBackground: true,
    showMeasurements: true,
  },
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: initialProject,
  mode: 'empty',
  selectedId: null,
  activeCategory: 'wall',
  transformMode: 'select',
  forbiddenZoneDrawMode: 'select',
  forbiddenZonesLocked: true,
  history: [],
  future: [],
  geometryErrors: [],
  pendingComponentPlacement: null,
  componentPlacementFeedback: null,
  activePerspectiveAxis: 'left',
  loadProject: (project) =>
    set({
      project: normalizeBoundComponentAttachments(project),
      mode: modeForProject(project),
      selectedId: project.planes.find((plane) => plane.type === 'wall')?.id ?? project.components[0]?.id ?? null,
      activeCategory: 'wall',
      activePerspectiveAxis: 'left',
      transformMode: 'select',
      forbiddenZoneDrawMode: 'select',
      forbiddenZonesLocked: true,
      history: [],
      future: [],
      geometryErrors: [],
      pendingComponentPlacement: null,
      componentPlacementFeedback: null,
    }),
  setSourceImage: (sourceImage) =>
    set((state) => ({
      project: { ...state.project, sourceImage, corners: [], ruler: null, perspectiveGuides: [], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], forbiddenZones: [], components: [] },
      mode: 'marking-perspective',
      selectedId: null,
      transformMode: 'select',
      forbiddenZoneDrawMode: 'select',
      forbiddenZonesLocked: true,
      geometryErrors: [],
      pendingComponentPlacement: null,
      componentPlacementFeedback: null,
      history: [],
      future: [],
    })),
  clearSourceImage: () =>
    set((state) => ({
      project: { ...state.project, sourceImage: null, corners: [], ruler: null, perspectiveGuides: [], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], forbiddenZones: [], components: [] },
      mode: 'empty',
      selectedId: null,
      transformMode: 'select',
      forbiddenZoneDrawMode: 'select',
      forbiddenZonesLocked: true,
      geometryErrors: [],
      pendingComponentPlacement: null,
      componentPlacementFeedback: null,
      history: [],
      future: [],
    })),
  clearDraft: () =>
    set((state) => ({
      project: {
        ...state.project,
        sourceImage: null,
        corners: [],
        ruler: null,
        perspectiveGuides: [],
        perspectiveCalibration: null,
        sceneCamera: null,
        polygons: [],
        planes: [],
        forbiddenZones: [],
        components: [],
      },
      mode: 'empty',
      selectedId: null,
      activeCategory: 'wall',
      activePerspectiveAxis: 'left',
      transformMode: 'select',
      forbiddenZoneDrawMode: 'select',
      forbiddenZonesLocked: true,
      history: [],
      future: [],
      geometryErrors: [],
      pendingComponentPlacement: null,
      componentPlacementFeedback: null,
    })),
  setMode: (mode) => set({ mode }),
  addCorner: (point, kind = 'wall') => {
    const corner: CornerPoint = { id: `corner-${Date.now()}-${Math.round(point.x)}-${Math.round(point.y)}`, x: point.x, y: point.y, kind }
    set((state) => ({
      project: { ...state.project, corners: [...state.project.corners, corner], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], forbiddenZones: [] },
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
        forbiddenZones: [],
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
        forbiddenZones: [],
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
      project: { ...state.project, perspectiveGuides: [...state.project.perspectiveGuides, guide], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], forbiddenZones: [] },
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
        project: { ...state.project, perspectiveGuides: [...state.project.perspectiveGuides, guide], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], forbiddenZones: [] },
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
        forbiddenZones: [],
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
        forbiddenZones: [],
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
      project: { ...state.project, corners: [], perspectiveGuides: [], perspectiveCalibration: null, sceneCamera: null, polygons: [], planes: [], forbiddenZones: [], components: [] },
      mode: state.project.sourceImage ? 'marking-perspective' : 'empty',
      selectedId: null,
      history: [],
      future: [],
      geometryErrors: [],
      componentPlacementFeedback: null,
      forbiddenZoneDrawMode: 'select',
      forbiddenZonesLocked: true,
    })),
  buildGeometry: () => {
    const { project, selectedId, mode, geometryErrors } = get()
    const perspectiveResult = buildPerspectiveRoom(project.sourceImage, project.perspectiveGuides, project.ruler, true, project.planes)
    const result = perspectiveResult.layout ? { polygons: [], errors: perspectiveResult.errors } : buildPolygons(project.corners, project.sourceImage)
    const planes = perspectiveResult.layout?.planes ?? buildPlanes(result.polygons, project.sourceImage, true, project.planes)
    const forbiddenZones = filterForbiddenZonesForPlanes(project.forbiddenZones, planes)
    const nextMode = planes.length ? 'editing-planes' : project.sourceImage ? 'marking-perspective' : 'empty'
    const nextSelectedId = planes.find((plane) => plane.type === 'wall')?.id ?? null
    set({
      project: {
        ...project,
        polygons: result.polygons,
        planes,
        forbiddenZones,
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
              forbiddenZones: project.forbiddenZones,
              perspectiveCalibration: project.perspectiveCalibration,
              sceneCamera: project.sceneCamera,
              selectedId,
              mode,
              geometryErrors,
            },
            to: {
              polygons: result.polygons,
              planes,
              forbiddenZones,
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
    const forbiddenZones = filterForbiddenZonesForPlanes(project.forbiddenZones, planes)
    const nextSelectedId = planes.find((plane) => plane.type === 'wall')?.id ?? null
    const nextMode: EditorMode = 'editing-planes'

    set({
      project: {
        ...project,
        polygons: [],
        planes,
        forbiddenZones,
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
              forbiddenZones: project.forbiddenZones,
              perspectiveCalibration: project.perspectiveCalibration,
              sceneCamera: project.sceneCamera,
              selectedId,
              mode,
              geometryErrors,
            },
            to: {
              polygons: [],
              planes,
              forbiddenZones,
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
      const planes = project.sceneCamera ? buildPerspectiveRoom(project.sourceImage, project.perspectiveGuides, project.ruler, value, project.planes).layout?.planes ?? project.planes : buildPlanes(project.polygons, project.sourceImage, value, project.planes)
      return {
        project: {
          ...project,
          planes,
          forbiddenZones: filterForbiddenZonesForPlanes(project.forbiddenZones, planes),
        },
        mode: project.polygons.length ? 'floor-optional' : state.mode,
        history: [...state.history, { type: 'toggle-floor', payload: { from: previous, to: value } }],
        future: [],
      }
    })
  },
  toggleMeasurements: (value) => {
    const previous = get().project.settings.showMeasurements ?? true
    set((state) => ({
      project: {
        ...state.project,
        settings: { ...state.project.settings, showMeasurements: value },
      },
      history: [...state.history, { type: 'toggle-measurements', payload: { from: previous, to: value } }],
      future: [],
    }))
  },
  updatePlaneSize: (id, field, value) =>
    set((state) => {
      const plane = state.project.planes.find((item) => item.id === id)
      if (!plane) return state
      return {
        project: applyPlanePatch(state.project, id, { [field]: value }),
        history: [...state.history, { type: 'update-plane', payload: { id, from: { [field]: plane[field] }, to: { [field]: value } } }],
        future: [],
      }
    }),
  updatePlaneTextureMapping: (id, enabled) =>
    set((state) => {
      const plane = state.project.planes.find((item) => item.id === id)
      if (!plane) return state
      return {
        project: applyPlanePatch(state.project, id, { textureEnabled: enabled }),
        history: [...state.history, { type: 'update-plane', payload: { id, from: { textureEnabled: plane.textureEnabled }, to: { textureEnabled: enabled } } }],
        future: [],
      }
    }),
  selectPlane: (id) => set({ selectedId: id }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  addForbiddenZone: (planeId, shape, start, end) =>
    set((state) => {
      const plane = state.project.planes.find((item) => item.id === planeId)
      if (!plane) return state
      const zone = buildForbiddenZoneFromDrag({
        id: `forbidden-zone-${Date.now()}`,
        name: `${plane.type === 'wall' ? '墙面' : '地面'}禁止区 ${state.project.forbiddenZones.length + 1}`,
        planeId,
        shape,
        start,
        end,
      })
      const blockingComponent = findBlockingComponentForForbiddenZone(zone, state.project.components, state.project.planes)
      if (blockingComponent) {
        return {
          componentPlacementFeedback: buildForbiddenZoneFeedback(plane, blockingComponent),
        }
      }

      return {
        project: {
          ...state.project,
          forbiddenZones: [...state.project.forbiddenZones, zone],
        },
        selectedId: zone.id,
        forbiddenZoneDrawMode: 'select',
        transformMode: 'select',
        history: [...state.history, { type: 'add-forbidden-zone', payload: { zone } }],
        future: [],
      }
    }),
  updateForbiddenZone: (id, zone) =>
    set((state) => {
      const current = state.project.forbiddenZones.find((item) => item.id === id)
      if (!current) return state
      const nextZone = { ...zone, id }
      const plane = state.project.planes.find((item) => item.id === nextZone.planeId)
      const blockingComponent = findBlockingComponentForForbiddenZone(nextZone, state.project.components, state.project.planes)
      if (blockingComponent && plane) {
        return {
          componentPlacementFeedback: buildForbiddenZoneFeedback(plane, blockingComponent),
        }
      }
      return {
        project: {
          ...state.project,
          forbiddenZones: state.project.forbiddenZones.map((item) => (item.id === id ? nextZone : item)),
        },
        history: [...state.history, { type: 'update-forbidden-zone', payload: { id, from: current, to: nextZone } }],
        future: [],
      }
    }),
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
      const params = createDefaultComponentParams(kind)
      const size = resolveComponentSizeFromParams(catalogItem?.defaultSize ?? { x: 0.46, y: 0.28, z: 0.14 }, catalogItem?.propertySchema ?? [], params)
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
      const nextComponent: SceneComponent = {
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
        params,
      }
      const blockingZone = findBlockingForbiddenZone(nextComponent, state.project.planes, state.project.forbiddenZones)
      if (blockingZone) {
        return {
          componentPlacementFeedback: buildPlacementFeedback({
            project: state.project,
            kind,
            requestedPlacement: placementMode,
            hit,
            targetPlaneId: placementResult.placement.targetPlaneId,
            level: 'error',
            reason: 'blocked-by-forbidden-zone',
            warnings: [],
            blockedZoneName: blockingZone.name,
          }),
        }
      }

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
          components: [...state.project.components, nextComponent],
        },
        selectedId: componentId,
        mode: 'dragging-components',
        componentPlacementFeedback: placementFeedback,
      }
    }),
  setTransformMode: (mode) => set({ transformMode: mode, forbiddenZoneDrawMode: 'select' }),
  setForbiddenZoneDrawMode: (mode) => set({ forbiddenZoneDrawMode: mode, transformMode: 'select' }),
  setForbiddenZonesLocked: (locked) => set({ forbiddenZonesLocked: locked }),
  updatePlaneTransform: (id, patch) =>
    set((state) => {
      const plane = state.project.planes.find((item) => item.id === id)
      if (!plane) return state
      return {
        project: applyPlanePatch(state.project, id, patch),
        history: [...state.history, { type: 'update-plane', payload: { id, from: { position: plane.position, rotation: plane.rotation }, to: patch } }],
        future: [],
      }
    }),
  updateComponentTransform: (id, patch) =>
    set((state) => {
      const component = state.project.components.find((item) => item.id === id)
      if (!component) return state
      const catalogItem = getComponentCatalogItem(component.kind)
      const patchWithParamSize =
        patch.params && !patch.size
          ? {
              ...patch,
              size: resolveComponentSizeFromParams(component.size ?? catalogItem?.defaultSize ?? { x: 0.46, y: 0.28, z: 0.14 }, catalogItem?.propertySchema ?? [], patch.params),
            }
          : patch
      const constrainedPatch = constrainComponentTransform(component, patchWithParamSize, state.project.planes, {
        defaultSize: catalogItem?.defaultSize,
        defaultRotation: catalogItem?.defaultRotation,
      })
      const nextComponent = { ...component, ...constrainedPatch }
      const blockingZone = findBlockingForbiddenZone(nextComponent, state.project.planes, state.project.forbiddenZones)
      if (blockingZone) {
        return {
          componentPlacementFeedback: buildPlacementFeedback({
            project: state.project,
            kind: component.kind,
            requestedPlacement: component.placement?.mode ?? catalogItem?.placement ?? 'free',
            hit: null,
            targetPlaneId: nextComponent.placement?.targetPlaneId ?? nextComponent.targetPlaneId,
            level: 'error',
            reason: 'blocked-by-forbidden-zone',
            warnings: [],
            blockedZoneName: blockingZone.name,
          }),
        }
      }
      const from = pickComponentPatch(component, constrainedPatch)
      return {
        project: {
          ...state.project,
          components: state.project.components.map((item) => (item.id === id ? nextComponent : item)),
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

      const forbiddenZoneIndex = state.project.forbiddenZones.findIndex((item) => item.id === state.selectedId)
      const forbiddenZone = state.project.forbiddenZones[forbiddenZoneIndex]
      if (forbiddenZone) {
        return {
          project: {
            ...state.project,
            forbiddenZones: state.project.forbiddenZones.filter((item) => item.id !== forbiddenZone.id),
          },
          selectedId: null,
          transformMode: 'select',
          forbiddenZoneDrawMode: 'select',
          history: [...state.history, { type: 'delete-forbidden-zone', payload: { zone: forbiddenZone, index: forbiddenZoneIndex, selectedId: state.selectedId } }],
          future: [],
        }
      }

      const planeIndex = state.project.planes.findIndex((item) => item.id === state.selectedId)
      const plane = state.project.planes[planeIndex]
      if (!plane || plane.type === 'floor') return state
      const removedForbiddenZones = state.project.forbiddenZones.filter((item) => item.planeId === plane.id)

      return {
        project: {
          ...state.project,
          planes: state.project.planes.filter((item) => item.id !== plane.id),
          forbiddenZones: state.project.forbiddenZones.filter((item) => item.planeId !== plane.id),
        },
        selectedId: null,
        transformMode: 'select',
        forbiddenZoneDrawMode: 'select',
        history: [...state.history, { type: 'delete-plane', payload: { plane, index: planeIndex, selectedId: state.selectedId, forbiddenZones: removedForbiddenZones } }],
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
        forbiddenZones: [],
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
        forbiddenZones: [],
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
        forbiddenZones: [],
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
    const planes = project.sceneCamera ? buildPerspectiveRoom(project.sourceImage, project.perspectiveGuides, project.ruler, value, project.planes).layout?.planes ?? project.planes : buildPlanes(project.polygons, project.sourceImage, value, project.planes)
    return {
      project: {
        ...project,
        planes,
        forbiddenZones: filterForbiddenZonesForPlanes(project.forbiddenZones, planes),
      },
    }
  }

  if (entry.type === 'toggle-measurements') {
    const value = redo ? entry.payload.to : entry.payload.from
    return {
      project: {
        ...state.project,
        settings: { ...state.project.settings, showMeasurements: value },
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
        forbiddenZones: snapshot.forbiddenZones,
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
    const removedForbiddenZones = entry.payload.forbiddenZones ?? []
    if (!redo) {
      planes.splice(entry.payload.index, 0, entry.payload.plane)
    }

    return {
      project: {
        ...state.project,
        planes: redo ? state.project.planes.filter((plane) => plane.id !== entry.payload.plane.id) : planes,
        forbiddenZones: redo
          ? state.project.forbiddenZones.filter((zone) => zone.planeId !== entry.payload.plane.id)
          : mergeForbiddenZones(state.project.forbiddenZones, removedForbiddenZones),
      },
      selectedId: redo ? null : entry.payload.selectedId,
      transformMode: 'select',
      forbiddenZoneDrawMode: 'select',
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

  if (entry.type === 'add-forbidden-zone') {
    return {
      project: {
        ...state.project,
        forbiddenZones: redo ? [...state.project.forbiddenZones, entry.payload.zone] : state.project.forbiddenZones.filter((zone) => zone.id !== entry.payload.zone.id),
      },
      selectedId: redo ? entry.payload.zone.id : null,
      forbiddenZoneDrawMode: 'select',
      transformMode: 'select',
    }
  }

  if (entry.type === 'delete-forbidden-zone') {
    const forbiddenZones = [...state.project.forbiddenZones]
    if (!redo) {
      forbiddenZones.splice(entry.payload.index, 0, entry.payload.zone)
    }

    return {
      project: {
        ...state.project,
        forbiddenZones: redo ? state.project.forbiddenZones.filter((zone) => zone.id !== entry.payload.zone.id) : forbiddenZones,
      },
      selectedId: redo ? null : entry.payload.selectedId,
      forbiddenZoneDrawMode: 'select',
      transformMode: 'select',
    }
  }

  if (entry.type === 'update-forbidden-zone') {
    const zone = redo ? entry.payload.to : entry.payload.from
    return {
      project: {
        ...state.project,
        forbiddenZones: state.project.forbiddenZones.map((item) => (item.id === entry.payload.id ? zone : item)),
      },
      selectedId: entry.payload.id,
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

  if (entry.type === 'update-plane') {
    const currentPlane = state.project.planes.find((plane) => plane.id === entry.payload.id)
    if (!currentPlane) return state
    return {
      project: applyPlanePatch(state.project, entry.payload.id, value),
    }
  }

  return {}
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

function mergeForbiddenZones(current: ForbiddenZone[], restored: ForbiddenZone[]) {
  const currentIds = new Set(current.map((zone) => zone.id))
  return [...current, ...restored.filter((zone) => !currentIds.has(zone.id))]
}

function applyPlanePatch(project: Project, id: string, patch: Partial<PlaneSpec>): Project {
  const previousPlanes = project.planes
  const editedPlane = previousPlanes.find((plane) => plane.id === id)
  const patchedPlanes = previousPlanes.map((plane) => (plane.id === id ? { ...plane, ...patch } : plane))
  const nextPlanes = editedPlane?.type === 'floor' ? patchedPlanes : reflowRoomPlanes(patchedPlanes)
  const previousById = new Map(previousPlanes.map((plane) => [plane.id, plane]))
  const changedPairs = nextPlanes
    .map((nextPlane) => {
      const previousPlane = previousById.get(nextPlane.id)
      return previousPlane && planeGeometryChanged(previousPlane, nextPlane) ? { previousPlane, nextPlane } : null
    })
    .filter((pair): pair is { previousPlane: PlaneSpec; nextPlane: PlaneSpec } => Boolean(pair))

  if (changedPairs.length === 0) {
    return {
      ...project,
      planes: nextPlanes,
    }
  }

  return {
    ...project,
    planes: nextPlanes,
    components: project.components.map((component) =>
      changedPairs.reduce((nextComponent, pair) => transformBoundComponentWithPlane(nextComponent, pair.previousPlane, pair.nextPlane), component),
    ),
  }
}

function planeGeometryChanged(previousPlane: PlaneSpec, nextPlane: PlaneSpec) {
  return (
    previousPlane.width !== nextPlane.width ||
    previousPlane.height !== nextPlane.height ||
    JSON.stringify(previousPlane.position) !== JSON.stringify(nextPlane.position) ||
    JSON.stringify(previousPlane.rotation) !== JSON.stringify(nextPlane.rotation)
  )
}

function normalizePlacementFailureReason(reason: string): ComponentPlacementFeedbackReason {
  if (reason === 'missing-hit' || reason === 'incompatible-surface' || reason === 'missing-plane') return reason
  return 'missing-hit'
}

function buildForbiddenZoneFeedback(plane: PlaneSpec, blockedComponent: SceneComponent): ComponentPlacementFeedback {
  return {
    id: `forbidden-zone-feedback-${Date.now()}`,
    level: 'error',
    reason: 'forbidden-zone-over-component',
    componentKind: 'forbidden-zone',
    requestedPlacement: plane.type,
    targetPlaneId: plane.id,
    warnings: [],
    title: '无法创建禁区',
    message: `禁区不能覆盖已有组件“${blockedComponent.name || getComponentLabel(blockedComponent.kind)}”。`,
    details: [`目标：${plane.name}`, '请避开组件占用范围后重新绘制'],
  }
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
  blockedZoneName,
}: {
  project: Project
  kind: SceneComponentKind
  requestedPlacement: ComponentPlacementMode
  hit: ComponentPlacementHit | null
  targetPlaneId?: string
  level: ComponentPlacementFeedback['level']
  reason: ComponentPlacementFeedbackReason
  warnings: ComponentPlacementWarning[]
  blockedZoneName?: string
}): ComponentPlacementFeedback {
  const componentLabel = getComponentLabel(kind)
  const requestedLabel = placementModeLabel(requestedPlacement)
  const hitLabel = hit ? planeTypeLabel(hit.planeType) : undefined
  const targetPlane = targetPlaneId ? project.planes.find((plane) => plane.id === targetPlaneId) : undefined
  const targetLabel = targetPlane?.name ?? targetPlaneId
  const details = buildPlacementDetails(reason, requestedLabel, hitLabel, targetLabel, warnings, blockedZoneName)

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
    message: placementFeedbackMessage(reason, componentLabel, requestedLabel, hitLabel, targetLabel, blockedZoneName),
    details: details.length > 0 ? details : undefined,
  }
}

function placementFeedbackTitle(level: ComponentPlacementFeedback['level']) {
  if (level === 'error') return '无法放置组件'
  if (level === 'warning') return '位置已调整'
  return '组件已放置'
}

function placementFeedbackMessage(reason: ComponentPlacementFeedbackReason, componentLabel: string, requestedLabel: string, hitLabel?: string, targetLabel?: string, blockedZoneName?: string) {
  if (reason === 'missing-hit') return `${componentLabel} 没有命中可放置的模型表面，未创建组件。`
  if (reason === 'incompatible-surface') return `${componentLabel} 需要放在${requestedLabel}，当前命中的是${hitLabel ?? '不支持的表面'}，未创建组件。`
  if (reason === 'missing-plane') return `${componentLabel} 命中的 plane 不在当前场景中，未创建组件。`
  if (reason === 'blocked-by-forbidden-zone') return `${componentLabel} 与禁止区域${blockedZoneName ? `「${blockedZoneName}」` : ''}重叠，已阻止摆放。`
  if (reason === 'placement-adjusted') return `${componentLabel} 已放置到${targetLabel ?? requestedLabel}，并按边界自动调整。`
  return `${componentLabel} 已放置到${targetLabel ?? requestedLabel}。`
}

function buildPlacementDetails(reason: ComponentPlacementFeedbackReason, requestedLabel: string, hitLabel: string | undefined, targetLabel: string | undefined, warnings: ComponentPlacementWarning[], blockedZoneName?: string) {
  const details: string[] = []
  if (targetLabel) details.push(`绑定对象：${targetLabel}`)
  if (reason === 'blocked-by-forbidden-zone' && blockedZoneName) details.push(`禁止区域：${blockedZoneName}`)
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

function normalizeBoundComponentAttachments(project: Project): Project {
  const normalizedProject = {
    ...project,
    forbiddenZones: filterForbiddenZonesForPlanes(project.forbiddenZones, project.planes),
  }
  if (normalizedProject.planes.length === 0 || normalizedProject.components.length === 0) return normalizedProject

  return {
    ...normalizedProject,
    components: normalizedProject.components.map((component) => {
      const mode = component.placement?.mode
      const targetPlaneId = component.placement?.targetPlaneId
      if (!mode || mode === 'free' || !targetPlaneId) return component

      const plane = normalizedProject.planes.find((item) => item.id === targetPlaneId && item.type === mode)
      if (!plane) return component

      const catalogItem = getComponentCatalogItem(component.kind)
      return projectBoundComponentOntoPlane(component, plane, {
        defaultSize: catalogItem?.defaultSize,
        defaultRotation: catalogItem?.defaultRotation,
      })
    }),
  }
}

function modeForProject(project: Project): EditorMode {
  if (project.planes.length > 0) return 'editing-planes'
  if (project.sourceImage) return 'marking-perspective'
  return 'empty'
}
