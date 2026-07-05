import { describe, expect, it } from 'vitest'
import type { PolygonSpec } from '../scene/types'
import { buildPlanes } from './buildPlanes'

describe('buildPlanes', () => {
  it('mirrors the right wall rotation in a three-wall layout', () => {
    const planes = buildPlanes(
      [
        polygon('right-polygon', 900),
        polygon('left-polygon', 100),
        polygon('center-polygon', 500),
      ],
      null,
      false,
    )

    const [leftWall, centerWall, rightWall] = planes

    expect(leftWall.id).toBe('wall-1')
    expect(leftWall.position.x).toBeLessThan(0)
    expect(leftWall.rotation.y).toBeCloseTo(Math.PI / 2)
    expect(centerWall.position.x).toBe(0)
    expect(centerWall.rotation.y).toBe(0)
    expect(rightWall.position.x).toBeGreaterThan(0)
    expect(rightWall.rotation.y).toBeCloseTo(-Math.PI / 2)
  })
})

function polygon(id: string, centerX: number): PolygonSpec {
  return {
    id,
    pointIds: [],
    area: 10000,
    center: { x: centerX, y: 300 },
    uv: [],
  }
}
