import { describe, expect, it } from 'vitest'
import { buildWallTemplatePlanes } from './wallTemplates'

describe('buildWallTemplatePlanes', () => {
  it('keeps default corner walls tangent instead of intersecting', () => {
    const planes = buildWallTemplatePlanes('three-wall', null, false)
    const leftWall = planes.find((plane) => plane.id === 'template-wall-left')
    const mainWall = planes.find((plane) => plane.id === 'template-wall-main')
    const rightWall = planes.find((plane) => plane.id === 'template-wall-right')

    expect(leftWall?.position).toMatchObject({ x: -1.85, z: 1.45 })
    expect(mainWall?.position).toMatchObject({ x: 0, z: 0 })
    expect(rightWall?.position).toMatchObject({ x: 1.85, z: 1.45 })
    expect(leftWall?.rotation.y).toBeCloseTo(Math.PI / 2)
    expect(rightWall?.rotation.y).toBeCloseTo(-Math.PI / 2)
  })
})
