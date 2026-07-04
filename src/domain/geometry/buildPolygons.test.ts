import { describe, expect, it } from 'vitest'
import type { CornerPoint, SourceImage } from '../scene/types'
import { buildPolygons } from './buildPolygons'
import { validateQuad } from './validateQuad'

const sourceImage: SourceImage = {
  url: 'blob:test-image',
  width: 1000,
  height: 800,
}

function point(id: string, x: number, y: number, kind: CornerPoint['kind'] = 'wall'): CornerPoint {
  return { id, x, y, kind }
}

describe('validateQuad', () => {
  it('accepts a valid quad and reports its area', () => {
    const result = validateQuad([
      point('a', 100, 100),
      point('b', 500, 100),
      point('c', 500, 400),
      point('d', 100, 400),
    ])

    expect(result).toEqual({ valid: true, area: 120000, reversed: false })
  })

  it('rejects self-intersecting quads before polygon generation', () => {
    const result = validateQuad([
      point('a', 100, 100),
      point('b', 500, 400),
      point('c', 500, 100),
      point('d', 100, 400),
    ])

    expect(result).toEqual({ valid: false, reason: 'self-intersection' })
  })
})

describe('buildPolygons', () => {
  it('builds polygons from wall points and ignores floor points', () => {
    const result = buildPolygons(
      [
        point('a', 100, 100),
        point('b', 500, 100),
        point('c', 500, 400),
        point('d', 100, 400),
        point('floor-marker', 300, 700, 'floor'),
      ],
      sourceImage,
    )

    expect(result.errors).toEqual([])
    expect(result.polygons).toHaveLength(1)
    expect(result.polygons[0]).toMatchObject({
      id: 'polygon-1',
      pointIds: ['a', 'b', 'c', 'd'],
      area: 120000,
      center: { x: 300, y: 250 },
    })
    expect(result.polygons[0].uv).toEqual([
      { x: 0.1, y: 0.875 },
      { x: 0.5, y: 0.875 },
      { x: 0.5, y: 0.5 },
      { x: 0.1, y: 0.5 },
    ])
  })

  it('returns a user-facing error when no image exists', () => {
    expect(buildPolygons([], null)).toEqual({
      polygons: [],
      errors: ['请先上传室内图'],
    })
  })
})
