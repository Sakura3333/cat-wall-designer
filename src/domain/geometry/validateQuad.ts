import type { CornerPoint, Vec2 } from '../scene/types'

export type QuadValidation =
  | { valid: true; area: number; reversed: boolean }
  | { valid: false; reason: 'points-too-few' | 'duplicate-points' | 'self-intersection' | 'area-too-small' }

export function validateQuad(points: CornerPoint[]): QuadValidation {
  if (points.length !== 4) return { valid: false, reason: 'points-too-few' }
  if (hasDuplicatePoints(points)) return { valid: false, reason: 'duplicate-points' }
  if (segmentsIntersect(points[0], points[1], points[2], points[3]) || segmentsIntersect(points[1], points[2], points[3], points[0])) {
    return { valid: false, reason: 'self-intersection' }
  }

  const signedArea = polygonArea(points)
  const area = Math.abs(signedArea)
  if (area < 1200) return { valid: false, reason: 'area-too-small' }

  return { valid: true, area, reversed: signedArea < 0 }
}

export function polygonArea(points: Vec2[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0) / 2
}

function hasDuplicatePoints(points: Vec2[]) {
  const seen = new Set<string>()
  for (const point of points) {
    const key = `${Math.round(point.x)}:${Math.round(point.y)}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)
  return o1 !== o2 && o3 !== o4
}

function orientation(a: Vec2, b: Vec2, c: Vec2) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
  return value > 0 ? 1 : value < 0 ? 2 : 0
}
