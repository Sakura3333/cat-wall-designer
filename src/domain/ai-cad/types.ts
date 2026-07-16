export type AiCadVec3 = { x: number; y: number; z: number }

export type VisionObservationV1 = {
  schemaVersion: 1
  jobId: string
  sourceImage: {
    fileName: string
    sha256: string
    widthPx: number
    heightPx: number
  }
  productFamilyCandidates: Array<{
    family: string
    confidence: number
  }>
  dimensionEvidence: Array<{
    id: string
    kind: 'overall-width' | 'overall-height' | 'overall-depth' | 'part-width' | 'part-height' | 'part-depth' | 'diameter' | 'thickness' | 'hole-diameter' | 'distance' | 'unknown'
    label: string
    valueMm: number
    axis: 'x' | 'y' | 'z' | 'diameter' | 'none'
    imageRegion: [number, number, number, number]
    sourceText: string
    confidence: number
    status: 'proposed' | 'confirmed' | 'rejected'
    notes?: string
  }>
  partCandidates: Array<{
    id: string
    kind: 'panel' | 'box' | 'cylinder' | 'hemisphere' | 'curved-panel' | 'support' | 'soft-part' | 'unknown'
    label: string
    imagePolygon?: Array<[number, number]>
    visible: boolean
    confidence: number
    notes?: string
  }>
  ambiguities: Array<{
    code: string
    message: string
    severity: 'info' | 'warning' | 'blocking'
    requiredResolution: string
  }>
}

export type ComponentSpecV1 = {
  schemaVersion: 1
  revision: number
  unit: 'mm'
  name: string
  family: string
  placement: 'wall' | 'floor' | 'free'
  overallSizeMm: AiCadVec3
  parts: Array<{
    id: string
    label: string
    shape: 'rect-panel' | 'round-panel' | 'box' | 'cylinder' | 'hemisphere' | 'curved-panel' | 'soft-template'
    sizeMm: AiCadVec3
    sizeStatus: 'proposed' | 'confirmed' | 'defaulted'
    hardConstraint: boolean
    materialRole: string
    notes?: string
  }>
  holes: Array<{
    id: string
    partId: string
    centerMm: AiCadVec3
    axis: AiCadVec3
    diameterMm: number
    depthMm?: number
    through: boolean
    source: 'user' | 'image-dimension' | 'engineering-drawing' | 'template'
    status: 'proposed' | 'confirmed' | 'rejected'
  }>
  assumptions: Array<{
    field: string
    reason: string
    severity: 'info' | 'warning' | 'blocking'
  }>
}

type ModelingTransform = {
  positionMm: AiCadVec3
  rotationDeg: AiCadVec3
}

export type ModelingPlanNodeV1 =
  | {
      id: string
      op: 'box'
      partId: string
      sizeMm: AiCadVec3
      transform: ModelingTransform
      materialRole?: string
    }
  | {
      id: string
      op: 'mounting-hole'
      holeId: string
      targetNodeId: string
      diameterMm: number
      depthMm?: number
      centerMm: AiCadVec3
      axis: '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z'
      through: boolean
    }

export type ModelingPlanV1 = {
  schemaVersion: 1
  componentSpecRevision: number
  coordinateSystem: {
    handedness: 'right'
    up: '+Y'
    front: '+Z'
    unit: 'mm'
  }
  nodes: ModelingPlanNodeV1[]
  export: {
    primary: 'glb'
    optional: Array<'blend' | 'obj' | 'fbx' | 'stl'>
    originPolicy: 'bounding-box-center'
    applyTransforms: true
  }
}

export type QualityReportV1 = {
  schemaVersion: 1
  jobId: string
  componentSpecRevision: number
  planHash: string
  compilerVersion: string
  blenderVersion: string
  status: 'passed' | 'failed'
  hardConstraintToleranceMm: number
  checks: Array<{
    id: string
    kind: 'overall-size' | 'part-size' | 'hole-diameter' | 'hole-center' | 'topology' | 'gltf' | 'render'
    status: 'passed' | 'warning' | 'failed'
    expectedMm?: number
    actualMm?: number
    deltaMm?: number
    message: string
  }>
  artifacts: Array<{
    kind: 'glb' | 'blend' | 'bpy' | 'obj' | 'fbx' | 'stl' | 'thumbnail' | 'log'
    fileName: string
    sha256: string
    sizeBytes: number
  }>
}
