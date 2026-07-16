import { describe, expect, it } from 'vitest'
import { WALL_SURFACE_LOCAL_Z } from './planeGeometryConstants'
import { reflowRoomPlanes } from './planeLayout'
import { buildWallTemplatePlanes } from './wallTemplates'
import { planeLocalToWorld, roundVec3 } from '../scene/planeMath'

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

  it('keeps side-wall hinge edges aligned after the main wall is resized', () => {
    const planes = reflowRoomPlanes(
      buildWallTemplatePlanes('three-wall', null, true).map((plane) => (plane.id === 'template-wall-main' ? { ...plane, width: 4.2 } : plane)),
    )
    const leftWall = planes.find((plane) => plane.id === 'template-wall-left')
    const mainWall = planes.find((plane) => plane.id === 'template-wall-main')
    const rightWall = planes.find((plane) => plane.id === 'template-wall-right')
    const floor = planes.find((plane) => plane.id === 'template-floor')

    expect(leftWall && mainWall ? hingePoint(leftWall, 'right') : null).toEqual(mainWall ? hingePoint(mainWall, 'left') : null)
    expect(rightWall && mainWall ? hingePoint(rightWall, 'left') : null).toEqual(mainWall ? hingePoint(mainWall, 'right') : null)
    expect(floor?.width).toBeGreaterThanOrEqual(4.68)
  })

  it('rotates template side walls around the shared corner hinge', () => {
    const basePlanes = buildWallTemplatePlanes('corner-two-wall', null, true)
    const rotatedPlanes = reflowRoomPlanes(
      basePlanes.map((plane) => (plane.id === 'template-wall-left' ? { ...plane, rotation: { ...plane.rotation, y: Math.PI / 3 } } : plane)),
    )
    const mainWall = rotatedPlanes.find((plane) => plane.id === 'template-wall-main')
    const leftWall = rotatedPlanes.find((plane) => plane.id === 'template-wall-left')

    expect(leftWall && mainWall ? hingePoint(leftWall, 'right') : null).toEqual(mainWall ? hingePoint(mainWall, 'left') : null)
  })

  it('refits the floor to contain moved template walls', () => {
    const planes = reflowRoomPlanes(
      buildWallTemplatePlanes('single-wall', null, true).map((plane) => (plane.id === 'template-wall-main' ? { ...plane, position: { ...plane.position, x: 1.5 } } : plane)),
    )
    const mainWall = planes.find((plane) => plane.id === 'template-wall-main')
    const floor = planes.find((plane) => plane.id === 'template-floor')

    expect(mainWall).toBeTruthy()
    expect(floor).toBeTruthy()
    expect(floor && mainWall ? floor.position.x + floor.width / 2 : 0).toBeGreaterThan((mainWall?.position.x ?? 0) + (mainWall?.width ?? 0) / 2)
  })
})

function hingePoint(plane: NonNullable<ReturnType<typeof buildWallTemplatePlanes>[number]>, edge: 'left' | 'right') {
  return roundVec3(planeLocalToWorld({ x: edge === 'left' ? -plane.width / 2 : plane.width / 2, y: 0, z: WALL_SURFACE_LOCAL_Z }, plane))
}
