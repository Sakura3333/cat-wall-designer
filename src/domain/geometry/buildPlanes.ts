import type { PlaneSpec, PolygonSpec, SourceImage } from '../scene/types'
import { WALL_THICKNESS } from './planeGeometryConstants'
import { buildFittedFloorPlane } from './planeLayout'

export function buildPlanes(polygons: PolygonSpec[], sourceImage: SourceImage | null, showFloor: boolean, previousPlanes: PlaneSpec[] = []): PlaneSpec[] {
  const orderedPolygons = [...polygons].sort((a, b) => a.center.x - b.center.x)
  const planeSizes = orderedPolygons.map((polygon) => {
    const previous = previousPlanes.find((plane) => plane.polygonId === polygon.id)
    return {
      width: previous?.width ?? 3.6,
      height: previous?.height ?? 2.4,
    }
  })
  const layout = buildWallLayout(planeSizes)

  const wallPlanes = orderedPolygons.map((polygon, index) => {
    const previous = previousPlanes.find((plane) => plane.polygonId === polygon.id)
    const transform = layout[index]
    const size = planeSizes[index]

    return {
      id: previous?.id ?? `wall-${index + 1}`,
      name: `墙面 plane ${index + 1}`,
      type: 'wall' as const,
      width: size.width,
      height: size.height,
      polygonId: polygon.id,
      textureUrl: sourceImage?.url,
      textureEnabled: previous?.textureEnabled ?? Boolean(sourceImage?.url),
      uvMode: 'auto' as const,
      position: transform.position,
      rotation: transform.rotation,
    }
  })

  if (!showFloor) return wallPlanes

  return [
    ...wallPlanes,
    buildFittedFloorPlane(wallPlanes, previousPlanes.find((plane) => plane.type === 'floor'), {
      id: 'floor-1',
      name: '地面 plane',
      textureUrl: sourceImage?.url,
      textureEnabled: Boolean(sourceImage?.url),
      fallbackWidth: 4.2,
      fallbackDepth: 2.4,
      y: -0.18,
    }),
  ]
}

function buildWallLayout(sizes: Array<{ width: number; height: number }>) {
  if (sizes.length === 3) {
    const centerWidth = sizes[1].width
    const cornerX = centerWidth / 2 + WALL_THICKNESS / 2
    return [
      {
        position: { x: -cornerX, y: 1.3, z: sizes[0].width / 2 + WALL_THICKNESS / 2 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
      },
      {
        position: { x: 0, y: 1.3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      {
        position: { x: cornerX, y: 1.3, z: sizes[2].width / 2 + WALL_THICKNESS / 2 },
        rotation: { x: 0, y: -Math.PI / 2, z: 0 },
      },
    ]
  }

  const safeCount = Math.max(sizes.length, 1)
  return Array.from({ length: sizes.length }, (_, index) => {
    const x = index * 2.35 - ((safeCount - 1) * 2.35) / 2
    return {
      position: { x, y: 1.3, z: index % 2 === 0 ? 0 : -0.12 },
      rotation: { x: 0, y: (index - (safeCount - 1) / 2) * -0.32, z: index % 2 === 0 ? 0.04 : -0.04 },
    }
  })
}
