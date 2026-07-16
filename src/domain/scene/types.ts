export type Vec2 = {
  x: number
  y: number
}

export type Vec3 = {
  x: number
  y: number
  z: number
}

export type SourceImage = {
  url: string
  width: number
  height: number
}

export type CornerKind = 'wall' | 'floor' | 'free'

export type CornerPoint = Vec2 & {
  id: string
  kind: CornerKind
}

export type RulerPoint = Vec2 & {
  id: string
}

export type RulerSpec = {
  points: RulerPoint[]
  lengthCm: number
}

export type PerspectiveAxis = 'left' | 'right' | 'vertical'

export type PerspectiveGuideLine = {
  id: string
  axis: PerspectiveAxis
  points: [Vec2, Vec2]
}

export type PerspectiveCalibration = {
  focalLengthPx: number
  fovDegrees: number
  principalPoint: Vec2
  vanishingPoints: Partial<Record<PerspectiveAxis, Vec2>>
}

export type SceneCameraSpec = {
  fov: number
  position: Vec3
  rotation: Vec3
}

export type PolygonSpec = {
  id: string
  pointIds: string[]
  area: number
  center: Vec2
  uv: Vec2[]
}

export type PlaneType = 'wall' | 'floor'

export type WallTemplateKind = 'single-wall' | 'corner-two-wall' | 'three-wall'

export type PlaneSpec = {
  id: string
  name: string
  type: PlaneType
  width: number
  height: number
  polygonId?: string
  textureUrl?: string
  textureEnabled: boolean
  uvMode: 'manual' | 'auto'
  position: Vec3
  rotation: Vec3
}

export type ForbiddenZoneShape = 'polygon' | 'ellipse'

export type ForbiddenZoneDrawMode = 'select' | 'rectangle' | 'ellipse'

export type ForbiddenZone = {
  id: string
  name: string
  planeId: string
  shape: ForbiddenZoneShape
  points?: Vec2[]
  center?: Vec2
  radiusX?: number
  radiusY?: number
}

export type SceneComponentKind = string

export type ComponentPlacementMode = 'wall' | 'floor' | 'free'

export type ComponentPlacementWarning = 'component-anchor-clamped' | 'component-width-exceeds-plane' | 'component-height-exceeds-plane' | 'component-depth-exceeds-plane'

export type ComponentPlacementFeedbackLevel = 'info' | 'warning' | 'error'

export type ComponentPlacementFeedbackReason = 'placed' | 'placement-adjusted' | 'missing-hit' | 'incompatible-surface' | 'missing-plane' | 'blocked-by-forbidden-zone' | 'forbidden-zone-over-component'

export type ComponentPlacementFeedback = {
  id: string
  level: ComponentPlacementFeedbackLevel
  reason: ComponentPlacementFeedbackReason
  componentKind: SceneComponentKind
  requestedPlacement: ComponentPlacementMode
  hitPlaneType?: PlaneType
  targetPlaneId?: string
  warnings: ComponentPlacementWarning[]
  title: string
  message: string
  details?: string[]
}

export type ComponentPlacement = {
  mode: ComponentPlacementMode
  targetPlaneId?: string
  anchor?: Vec3
  normal?: Vec3
}

export type ComponentPlacementSurface = 'front' | 'back' | 'top' | 'side'

export type ComponentPlacementHit = {
  planeId: string
  planeType: PlaneType
  point: Vec3
  normal: Vec3
  surface?: ComponentPlacementSurface
}

export type PendingComponentPlacement = {
  id: string
  kind: SceneComponentKind
  clientPoint: Vec2 | null
}

export type ComponentMaterial = {
  color?: string
  textureUrl?: string
}

export type ComponentPropertyValue = string | number | boolean

export type ComponentPropertyModelBinding =
  | { kind: 'none' }
  | { kind: 'material-color'; target?: string }
  | { kind: 'part-visibility'; target: string; visibleWhen?: boolean }
  | { kind: 'size-axis'; axis: 'x' | 'y' | 'z' }

export type ComponentPropertySchema = {
  id: string
  label: string
  type: 'number' | 'boolean' | 'color' | 'text'
  min?: number
  max?: number
  step?: number
  unit?: string
  defaultValue?: ComponentPropertyValue
  modelBinding?: ComponentPropertyModelBinding
}

export type SceneComponent = {
  id: string
  kind: SceneComponentKind
  name: string
  targetPlaneId?: string
  placement?: ComponentPlacement
  position: Vec3
  rotation: Vec3
  scale?: Vec3
  size?: Vec3
  material?: ComponentMaterial
  params?: Record<string, ComponentPropertyValue>
}

export type Project = {
  id: string
  name: string
  sourceImage: SourceImage | null
  corners: CornerPoint[]
  ruler: RulerSpec | null
  perspectiveGuides: PerspectiveGuideLine[]
  perspectiveCalibration: PerspectiveCalibration | null
  sceneCamera: SceneCameraSpec | null
  polygons: PolygonSpec[]
  planes: PlaneSpec[]
  forbiddenZones: ForbiddenZone[]
  components: SceneComponent[]
  settings: {
    showFloor: boolean
    sketchBackground: boolean
    showMeasurements: boolean
  }
}

export type EditorMode =
  | 'empty'
  | 'image-loaded'
  | 'marking-corners'
  | 'marking-ruler'
  | 'marking-perspective'
  | 'geometry-built'
  | 'floor-optional'
  | 'editing-planes'
  | 'dragging-components'
  | 'exporting'

export type TransformMode = 'select' | 'translate' | 'rotate'

export type HistoryEntry =
  | { type: 'add-corner'; payload: CornerPoint }
  | { type: 'delete-corner'; payload: { corner: CornerPoint; index: number } }
  | { type: 'move-corner'; payload: { id: string; from: Vec2; to: Vec2 } }
  | {
      type: 'build-geometry'
      payload: {
        from: {
          polygons: PolygonSpec[]
          planes: PlaneSpec[]
          forbiddenZones: ForbiddenZone[]
          perspectiveCalibration: PerspectiveCalibration | null
          sceneCamera: SceneCameraSpec | null
          selectedId: string | null
          mode: EditorMode
          geometryErrors: string[]
        }
        to: {
          polygons: PolygonSpec[]
          planes: PlaneSpec[]
          forbiddenZones: ForbiddenZone[]
          perspectiveCalibration: PerspectiveCalibration | null
          sceneCamera: SceneCameraSpec | null
          selectedId: string | null
          mode: EditorMode
          geometryErrors: string[]
        }
      }
    }
  | { type: 'update-plane'; payload: { id: string; from: Partial<PlaneSpec>; to: Partial<PlaneSpec> } }
  | { type: 'update-component'; payload: { id: string; from: Partial<SceneComponent>; to: Partial<SceneComponent> } }
  | { type: 'add-forbidden-zone'; payload: { zone: ForbiddenZone } }
  | { type: 'update-forbidden-zone'; payload: { id: string; from: ForbiddenZone; to: ForbiddenZone } }
  | { type: 'delete-plane'; payload: { plane: PlaneSpec; index: number; selectedId: string | null; forbiddenZones?: ForbiddenZone[] } }
  | { type: 'delete-component'; payload: { component: SceneComponent; index: number; selectedId: string | null } }
  | { type: 'delete-forbidden-zone'; payload: { zone: ForbiddenZone; index: number; selectedId: string | null } }
  | { type: 'toggle-floor'; payload: { from: boolean; to: boolean } }
  | { type: 'toggle-measurements'; payload: { from: boolean; to: boolean } }
