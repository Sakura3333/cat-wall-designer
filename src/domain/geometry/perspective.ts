import type { PerspectiveAxis, PerspectiveCalibration, PerspectiveGuideLine, PlaneSpec, RulerSpec, SceneCameraSpec, SourceImage, Vec2 } from '../scene/types'

type LineEquation = {
  a: number
  b: number
  c: number
}

type RoomLayout = {
  planes: PlaneSpec[]
  camera: SceneCameraSpec
  calibration: PerspectiveCalibration
}

const DEFAULT_WALL_HEIGHT = 2.4
const DEFAULT_WALL_WIDTH = 3.6
const DEFAULT_ROOM_DEPTH = 2.6

export function buildPerspectiveRoom(sourceImage: SourceImage | null, guides: PerspectiveGuideLine[], ruler: RulerSpec | null, showFloor: boolean, previousPlanes: PlaneSpec[] = []): { layout: RoomLayout | null; errors: string[] } {
  const calibrationResult = buildPerspectiveCalibration(sourceImage, guides)
  if (!calibrationResult.calibration) return { layout: null, errors: calibrationResult.errors }

  const { calibration } = calibrationResult
  const verticalVp = calibration.vanishingPoints.vertical
  const yaw = estimateYaw(calibration.vanishingPoints.left!, calibration.vanishingPoints.right!, calibration.principalPoint, calibration.focalLengthPx)
  const pitch = verticalVp ? clamp(Math.atan2(calibration.principalPoint.y - verticalVp.y, calibration.focalLengthPx) * 0.45, -0.32, 0.32) : 0

  return {
    layout: {
      calibration,
      camera: {
        fov: clamp(calibration.fovDegrees, 32, 82),
        position: { x: 0, y: 1.6, z: 5.6 },
        rotation: { x: pitch, y: yaw, z: 0 },
      },
      planes: buildPerspectivePlanes(calibrationResult.sourceImage, guides, ruler, calibration, showFloor, previousPlanes),
    },
    errors: [],
  }
}

export function buildPerspectiveCalibration(sourceImage: SourceImage | null, guides: PerspectiveGuideLine[]): { calibration: PerspectiveCalibration | null; sourceImage: SourceImage; errors: string[] } {
  if (!sourceImage) return { calibration: null, sourceImage: { url: '', width: 1, height: 1 }, errors: ['请先上传室内图'] }

  const leftLines = linesForAxis(guides, 'left')
  const rightLines = linesForAxis(guides, 'right')
  const verticalLines = linesForAxis(guides, 'vertical')
  const errors: string[] = []

  if (leftLines.length < 2) errors.push('左向透视线至少需要 2 条')
  if (rightLines.length < 2) errors.push('右向透视线至少需要 2 条')
  if (errors.length) return { calibration: null, sourceImage, errors }

  const leftVp = averageIntersections(leftLines)
  const rightVp = averageIntersections(rightLines)
  if (!leftVp || !rightVp) return { calibration: null, sourceImage, errors: ['透视线接近平行，无法求出稳定消失点'] }

  const verticalVp = verticalLines.length >= 2 ? averageIntersections(verticalLines) ?? undefined : undefined
  const principalPoint = { x: sourceImage.width / 2, y: sourceImage.height / 2 }
  const focalLengthPx = estimateFocalLength(leftVp, rightVp, principalPoint, sourceImage)

  return {
    calibration: {
      focalLengthPx,
      fovDegrees: radiansToDegrees(2 * Math.atan(sourceImage.height / (2 * focalLengthPx))),
      principalPoint,
      vanishingPoints: {
        left: leftVp,
        right: rightVp,
        vertical: verticalVp,
      },
    },
    sourceImage,
    errors: [],
  }
}

export function estimatePerspectiveGuideLengthCm(guide: PerspectiveGuideLine, ruler: RulerSpec | null, calibration: PerspectiveCalibration | null) {
  if (!ruler || ruler.points.length !== 2 || ruler.lengthCm <= 0) return null

  const rulerPixelLength = distance(ruler.points[0], ruler.points[1])
  const guidePixelLength = distance(guide.points[0], guide.points[1])
  if (rulerPixelLength <= 0 || guidePixelLength <= 0) return null

  const baseCmPerPixel = ruler.lengthCm / rulerPixelLength
  const vanishingPoint = calibration?.vanishingPoints[guide.axis]
  if (!vanishingPoint) return guidePixelLength * baseCmPerPixel

  const rulerMidpoint = midpoint(ruler.points[0], ruler.points[1])
  const guideMidpoint = midpoint(guide.points[0], guide.points[1])
  const rulerDepthFactor = distance(rulerMidpoint, vanishingPoint)
  const guideDepthFactor = distance(guideMidpoint, vanishingPoint)
  if (rulerDepthFactor <= 1 || guideDepthFactor <= 1) return guidePixelLength * baseCmPerPixel

  // Along one vanishing direction, equal world lengths shrink roughly with
  // distance to that vanishing point. The ruler anchors the scale at its own
  // image depth; the correction transfers that scale to the guide midpoint.
  const perspectiveCorrection = clamp(rulerDepthFactor / guideDepthFactor, 0.25, 4)
  return guidePixelLength * baseCmPerPixel * perspectiveCorrection
}

function measureRoomDimensions(guides: PerspectiveGuideLine[], ruler: RulerSpec | null, calibration: PerspectiveCalibration) {
  const left = measuredMetersForAxis(guides, ruler, calibration, 'left', 0.6, 8)
  const right = measuredMetersForAxis(guides, ruler, calibration, 'right', 0.6, 8)
  const vertical = measuredMetersForAxis(guides, ruler, calibration, 'vertical', 0.8, 4.5)

  return {
    leftWidth: left,
    rightWidth: right,
    wallHeight: vertical,
  }
}

function measuredMetersForAxis(guides: PerspectiveGuideLine[], ruler: RulerSpec | null, calibration: PerspectiveCalibration, axis: PerspectiveAxis, min: number, max: number) {
  const measuredLengths = guides
    .filter((guide) => guide.axis === axis)
    .map((guide) => estimatePerspectiveGuideLengthCm(guide, ruler, calibration))
    .filter((length): length is number => typeof length === 'number' && Number.isFinite(length) && length > 0)

  if (!measuredLengths.length) return null
  const meters = Math.max(...measuredLengths) / 100
  return clamp(meters, min, max)
}

function buildPerspectivePlanes(sourceImage: SourceImage, guides: PerspectiveGuideLine[], ruler: RulerSpec | null, calibration: PerspectiveCalibration, showFloor: boolean, previousPlanes: PlaneSpec[]) {
  const leftPrevious = previousPlanes.find((plane) => plane.id === 'perspective-wall-left')
  const rightPrevious = previousPlanes.find((plane) => plane.id === 'perspective-wall-right')
  const floorPrevious = previousPlanes.find((plane) => plane.id === 'perspective-floor')
  const measured = measureRoomDimensions(guides, ruler, calibration)
  const leftWidth = leftPrevious?.width ?? measured.leftWidth ?? DEFAULT_WALL_WIDTH
  const rightWidth = rightPrevious?.width ?? measured.rightWidth ?? DEFAULT_WALL_WIDTH
  const wallHeight = leftPrevious?.height ?? rightPrevious?.height ?? measured.wallHeight ?? DEFAULT_WALL_HEIGHT
  const floorDepth = Math.max(floorPrevious?.height ?? 0, measured.rightWidth ?? DEFAULT_ROOM_DEPTH, DEFAULT_ROOM_DEPTH)

  const planes: PlaneSpec[] = [
    {
      id: leftPrevious?.id ?? 'perspective-wall-left',
      name: '左侧透视墙面',
      type: 'wall',
      width: leftWidth,
      height: wallHeight,
      textureUrl: sourceImage.url,
      textureEnabled: leftPrevious?.textureEnabled ?? false,
      uvMode: 'auto',
      position: { x: -leftWidth / 2, y: wallHeight / 2, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
    },
    {
      id: rightPrevious?.id ?? 'perspective-wall-right',
      name: '右侧透视墙面',
      type: 'wall',
      width: rightWidth,
      height: wallHeight,
      textureUrl: sourceImage.url,
      textureEnabled: rightPrevious?.textureEnabled ?? false,
      uvMode: 'auto',
      position: { x: 0, y: wallHeight / 2, z: -rightWidth / 2 },
      rotation: { x: 0, y: 0, z: 0 },
    },
  ]

  if (showFloor) {
    planes.push({
      id: floorPrevious?.id ?? 'perspective-floor',
      name: '透视地面',
      type: 'floor',
      width: Math.max(floorPrevious?.width ?? 0, leftWidth + 0.3),
      height: floorDepth,
      textureUrl: sourceImage.url,
      textureEnabled: floorPrevious?.textureEnabled ?? false,
      uvMode: 'auto',
      position: { x: -leftWidth / 2, y: 0, z: -floorDepth / 2 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    })
  }

  return planes
}

function linesForAxis(guides: PerspectiveGuideLine[], axis: PerspectiveAxis) {
  return guides
    .filter((guide) => guide.axis === axis)
    .map((guide) => toLineEquation(guide.points[0], guide.points[1]))
    .filter((line): line is LineEquation => Boolean(line))
}

function toLineEquation(a: Vec2, b: Vec2): LineEquation | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length < 8) return null
  return {
    a: dy / length,
    b: -dx / length,
    c: (dx * a.y - dy * a.x) / length,
  }
}

function averageIntersections(lines: LineEquation[]) {
  const points: Vec2[] = []
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const point = intersectLines(lines[i], lines[j])
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point)
    }
  }
  if (!points.length) return null
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
}

function intersectLines(first: LineEquation, second: LineEquation): Vec2 | null {
  const determinant = first.a * second.b - second.a * first.b
  if (Math.abs(determinant) < 0.0001) return null
  return {
    x: (first.b * second.c - second.b * first.c) / determinant,
    y: (first.c * second.a - second.c * first.a) / determinant,
  }
}

function estimateFocalLength(leftVp: Vec2, rightVp: Vec2, principalPoint: Vec2, sourceImage: SourceImage) {
  const left = subtract(leftVp, principalPoint)
  const right = subtract(rightVp, principalPoint)
  const squared = -(left.x * right.x + left.y * right.y)
  if (squared > 1) return Math.sqrt(squared)
  return Math.max(sourceImage.width, sourceImage.height) * 0.86
}

function estimateYaw(leftVp: Vec2, rightVp: Vec2, principalPoint: Vec2, focalLengthPx: number) {
  const midpointPoint = midpoint(leftVp, rightVp)
  return clamp(Math.atan2(midpointPoint.x - principalPoint.x, focalLengthPx), -0.55, 0.55)
}

function subtract(a: Vec2, b: Vec2) {
  return { x: a.x - b.x, y: a.y - b.y }
}

function midpoint(a: Vec2, b: Vec2) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
