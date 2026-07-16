import type { PlaneSpec, Vec3 } from '../scene/types'
import { planeLocalToWorld, rotateVec3, roundNumber, roundVec3 } from '../scene/planeMath'
import { FLOOR_THICKNESS, WALL_SURFACE_LOCAL_Z, WALL_THICKNESS } from './planeGeometryConstants'

const FLOOR_MARGIN = 0.24
const DEFAULT_FLOOR_WIDTH = 4.2
const DEFAULT_FLOOR_DEPTH = 3

type SideWallId = 'template-wall-left' | 'template-wall-right'

type FloorDefaults = {
  id: string
  name: string
  textureUrl?: string
  textureEnabled: boolean
  fallbackWidth?: number
  fallbackDepth?: number
  y?: number
}

export function reflowRoomPlanes(planes: PlaneSpec[]): PlaneSpec[] {
  return fitFloorToWallBounds(reflowTemplateWallCorners(planes))
}

export function reflowTemplateWallCorners(planes: PlaneSpec[]): PlaneSpec[] {
  const byId = new Map(planes.map((plane) => [plane.id, plane]))
  const mainWall = byId.get('template-wall-main')
  if (!mainWall || mainWall.type !== 'wall') return planes

  const updates = new Map<string, PlaneSpec>()
  const normalizedMain = alignWallBottom(mainWall)
  updates.set(normalizedMain.id, normalizedMain)

  ;(['template-wall-left', 'template-wall-right'] as SideWallId[]).forEach((id) => {
    const sideWall = byId.get(id)
    if (!sideWall || sideWall.type !== 'wall') return

    const alignedSideWall = alignWallBottom(sideWall)
    updates.set(id, {
      ...alignedSideWall,
      position: templateSideWallCenter(normalizedMain, alignedSideWall, id),
    })
  })

  return planes.map((plane) => updates.get(plane.id) ?? plane)
}

export function fitFloorToWallBounds(planes: PlaneSpec[]): PlaneSpec[] {
  const floor = planes.find((plane) => plane.type === 'floor')
  if (!floor) return planes

  const walls = planes.filter((plane) => plane.type === 'wall')
  const fittedFloor = buildFittedFloorPlane(walls, floor, {
    id: floor.id,
    name: floor.name,
    textureUrl: floor.textureUrl,
    textureEnabled: floor.textureEnabled,
    y: floor.position.y,
  })

  return planes.map((plane) => (plane.id === floor.id ? fittedFloor : plane))
}

export function buildFittedFloorPlane(walls: PlaneSpec[], previousFloor: PlaneSpec | undefined, defaults: FloorDefaults): PlaneSpec {
  const bounds = buildWallFootprintBounds(walls)
  const requiredWidth = bounds ? bounds.maxX - bounds.minX + FLOOR_MARGIN * 2 : defaults.fallbackWidth ?? DEFAULT_FLOOR_WIDTH
  const requiredDepth = bounds ? bounds.maxZ - bounds.minZ + FLOOR_MARGIN * 2 : defaults.fallbackDepth ?? DEFAULT_FLOOR_DEPTH
  const width = roundNumber(Math.max(previousFloor?.width ?? 0, requiredWidth))
  const height = roundNumber(Math.max(previousFloor?.height ?? 0, requiredDepth))
  const centerX = bounds ? (bounds.minX + bounds.maxX) / 2 : previousFloor?.position.x ?? 0
  const centerZ = bounds ? (bounds.minZ + bounds.maxZ) / 2 : previousFloor?.position.z ?? height / 2 - FLOOR_MARGIN / 2

  return {
    id: previousFloor?.id ?? defaults.id,
    name: previousFloor?.name ?? defaults.name,
    type: 'floor',
    width,
    height,
    textureUrl: defaults.textureUrl ?? previousFloor?.textureUrl,
    textureEnabled: previousFloor?.textureEnabled ?? defaults.textureEnabled,
    uvMode: 'auto',
    position: {
      x: roundNumber(centerX),
      y: previousFloor?.position.y ?? defaults.y ?? 0,
      z: roundNumber(centerZ),
    },
    rotation: previousFloor?.rotation ?? { x: -Math.PI / 2, y: 0, z: 0 },
  }
}

export function buildWallFootprintBounds(walls: PlaneSpec[]) {
  const points = walls.flatMap((wall) => wallFootprintPoints(wall))
  if (!points.length) return null

  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minZ: Math.min(bounds.minZ, point.z),
      maxZ: Math.max(bounds.maxZ, point.z),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  )
}

function templateSideWallCenter(mainWall: PlaneSpec, sideWall: PlaneSpec, sideWallId: SideWallId): Vec3 {
  const mainLocalX = sideWallId === 'template-wall-left' ? -mainWall.width / 2 : mainWall.width / 2
  const sideLocalX = sideWallId === 'template-wall-left' ? sideWall.width / 2 : -sideWall.width / 2
  const hinge = planeLocalToWorld({ x: mainLocalX, y: 0, z: WALL_SURFACE_LOCAL_Z }, mainWall)
  const hingeOffset = rotateVec3({ x: sideLocalX, y: 0, z: WALL_SURFACE_LOCAL_Z }, sideWall.rotation)

  return roundVec3({
    x: hinge.x - hingeOffset.x,
    y: sideWall.height / 2,
    z: hinge.z - hingeOffset.z,
  })
}

function alignWallBottom(wall: PlaneSpec): PlaneSpec {
  return {
    ...wall,
    position: {
      ...wall.position,
      y: roundNumber(wall.height / 2),
    },
  }
}

function wallFootprintPoints(wall: PlaneSpec): Vec3[] {
  const halfWidth = wall.width / 2
  const halfDepth = wall.type === 'floor' ? FLOOR_THICKNESS / 2 : WALL_THICKNESS / 2
  return [
    planeLocalToWorld({ x: -halfWidth, y: 0, z: -halfDepth }, wall),
    planeLocalToWorld({ x: halfWidth, y: 0, z: -halfDepth }, wall),
    planeLocalToWorld({ x: halfWidth, y: 0, z: halfDepth }, wall),
    planeLocalToWorld({ x: -halfWidth, y: 0, z: halfDepth }, wall),
  ]
}
