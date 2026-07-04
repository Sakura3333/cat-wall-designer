import type { CornerPoint, Vec2 } from '../scene/types'

export function buildUvForQuad(points: CornerPoint[], imageSize: { width: number; height: number }): Vec2[] {
  return points.map((point) => ({
    x: Number((point.x / imageSize.width).toFixed(4)),
    y: Number((1 - point.y / imageSize.height).toFixed(4)),
  }))
}
