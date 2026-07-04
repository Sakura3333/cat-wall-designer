import type { PlaneSpec, SourceImage, WallTemplateKind } from '../scene/types'

const WALL_WIDTH = 3.6
const WALL_HEIGHT = 2.4
const SIDE_WIDTH = 2.8
const FLOOR_DEPTH = 3.0
const FLOOR_MARGIN = 0.24

export function buildWallTemplatePlanes(kind: WallTemplateKind, sourceImage: SourceImage | null, showFloor: boolean, previousPlanes: PlaneSpec[] = []) {
  const previousById = new Map(previousPlanes.map((plane) => [plane.id, plane]))
  const walls = templateWalls(kind, sourceImage, previousById)

  if (!showFloor) return walls

  const previousFloor = previousById.get('template-floor')
  const floorWidth = kind === 'single-wall' ? WALL_WIDTH + FLOOR_MARGIN : WALL_WIDTH + FLOOR_MARGIN
  const floorDepth = kind === 'single-wall' ? FLOOR_DEPTH : SIDE_WIDTH + FLOOR_MARGIN
  return [
    ...walls,
    {
      id: previousFloor?.id ?? 'template-floor',
      name: '模板地面',
      type: 'floor' as const,
      width: Math.max(previousFloor?.width ?? 0, floorWidth),
      height: Math.max(previousFloor?.height ?? 0, floorDepth),
      textureUrl: sourceImage?.url,
      textureEnabled: previousFloor?.textureEnabled ?? false,
      uvMode: 'auto' as const,
      position: { x: 0, y: 0, z: floorDepth / 2 - FLOOR_MARGIN / 2 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    },
  ]
}

function templateWalls(kind: WallTemplateKind, sourceImage: SourceImage | null, previousById: Map<string, PlaneSpec>) {
  if (kind === 'single-wall') {
    return [
      wallPlane('template-wall-main', '单面墙', WALL_WIDTH, WALL_HEIGHT, { x: 0, y: WALL_HEIGHT / 2, z: 0 }, { x: 0, y: 0, z: 0 }, sourceImage, previousById),
    ]
  }

  if (kind === 'corner-two-wall') {
    return [
      wallPlane('template-wall-left', '左侧夹角墙', SIDE_WIDTH, WALL_HEIGHT, { x: -WALL_WIDTH / 2, y: WALL_HEIGHT / 2, z: SIDE_WIDTH / 2 }, { x: 0, y: Math.PI / 2, z: 0 }, sourceImage, previousById),
      wallPlane('template-wall-main', '正面墙', WALL_WIDTH, WALL_HEIGHT, { x: 0, y: WALL_HEIGHT / 2, z: 0 }, { x: 0, y: 0, z: 0 }, sourceImage, previousById),
    ]
  }

  return [
    wallPlane('template-wall-left', '左侧夹角墙', SIDE_WIDTH, WALL_HEIGHT, { x: -WALL_WIDTH / 2, y: WALL_HEIGHT / 2, z: SIDE_WIDTH / 2 }, { x: 0, y: Math.PI / 2, z: 0 }, sourceImage, previousById),
    wallPlane('template-wall-main', '中间墙', WALL_WIDTH, WALL_HEIGHT, { x: 0, y: WALL_HEIGHT / 2, z: 0 }, { x: 0, y: 0, z: 0 }, sourceImage, previousById),
    wallPlane('template-wall-right', '右侧夹角墙', SIDE_WIDTH, WALL_HEIGHT, { x: WALL_WIDTH / 2, y: WALL_HEIGHT / 2, z: SIDE_WIDTH / 2 }, { x: 0, y: -Math.PI / 2, z: 0 }, sourceImage, previousById),
  ]
}

function wallPlane(
  id: string,
  name: string,
  width: number,
  height: number,
  position: PlaneSpec['position'],
  rotation: PlaneSpec['rotation'],
  sourceImage: SourceImage | null,
  previousById: Map<string, PlaneSpec>,
): PlaneSpec {
  const previous = previousById.get(id)
  return {
    id: previous?.id ?? id,
    name,
    type: 'wall',
    width: previous?.width ?? width,
    height: previous?.height ?? height,
    textureUrl: sourceImage?.url,
    textureEnabled: previous?.textureEnabled ?? false,
    uvMode: 'auto',
    position,
    rotation,
  }
}
