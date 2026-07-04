import type { CornerPoint, PolygonSpec, SourceImage } from '../scene/types'
import { buildUvForQuad } from './uvMapping'
import { validateQuad } from './validateQuad'

export type BuildPolygonsResult = {
  polygons: PolygonSpec[]
  errors: string[]
}

export function buildPolygons(corners: CornerPoint[], sourceImage: SourceImage | null): BuildPolygonsResult {
  if (!sourceImage) return { polygons: [], errors: ['请先上传室内图'] }

  const errors: string[] = []
  const polygons: PolygonSpec[] = []
  const wallPoints = corners.filter((corner) => corner.kind !== 'floor')

  for (let index = 0; index < wallPoints.length; index += 4) {
    const quad = wallPoints.slice(index, index + 4)
    if (quad.length === 0) continue

    const validation = validateQuad(quad)
    if (!validation.valid) {
      errors.push(validationMessage(index / 4 + 1, validation.reason))
      continue
    }

    const orderedQuad = validation.reversed ? [...quad].reverse() : quad
    polygons.push({
      id: `polygon-${polygons.length + 1}`,
      pointIds: orderedQuad.map((point) => point.id),
      area: Math.round(validation.area),
      center: getCenter(orderedQuad),
      uv: buildUvForQuad(orderedQuad, sourceImage),
    })
  }

  if (polygons.length === 0 && wallPoints.length < 4) errors.push('至少需要 4 个角点才能生成墙面 plane')

  return { polygons, errors }
}

function getCenter(points: CornerPoint[]) {
  const sum = points.reduce(
    (total, point) => ({
      x: total.x + point.x,
      y: total.y + point.y,
    }),
    { x: 0, y: 0 },
  )

  return {
    x: Number((sum.x / points.length).toFixed(2)),
    y: Number((sum.y / points.length).toFixed(2)),
  }
}

function validationMessage(index: number, reason: string) {
  const messages: Record<string, string> = {
    'points-too-few': '点数量不足',
    'duplicate-points': '存在重复点',
    'self-intersection': '四边形自交',
    'area-too-small': '面积过小',
  }
  return `第 ${index} 组四边形无效：${messages[reason] ?? reason}`
}
