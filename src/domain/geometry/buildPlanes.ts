import type { PlaneSpec, PolygonSpec, SourceImage } from '../scene/types'

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

  const previousFloor = previousPlanes.find((plane) => plane.type === 'floor')
  const wallSpan = wallPlanes.reduce(
    (bounds, plane) => ({
      minX: Math.min(bounds.minX, plane.position.x - plane.width / 2),
      maxX: Math.max(bounds.maxX, plane.position.x + plane.width / 2),
      maxZ: Math.max(bounds.maxZ, plane.position.z + plane.width / 2),
    }),
    { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxZ: 0 },
  )
  const floorWidth = Number.isFinite(wallSpan.minX) ? wallSpan.maxX - wallSpan.minX + 0.4 : 4.2
  const floorDepth = Math.max(2.4, wallSpan.maxZ + 0.4)
  return [
    ...wallPlanes,
    {
      id: previousFloor?.id ?? 'floor-1',
      name: '地面 plane',
      type: 'floor',
      width: Math.max(previousFloor?.width ?? 0, floorWidth),
      height: Math.max(previousFloor?.height ?? 0, floorDepth),
      textureUrl: sourceImage?.url,
      textureEnabled: previousFloor?.textureEnabled ?? Boolean(sourceImage?.url),
      uvMode: 'auto',
      position: { x: 0, y: -0.18, z: floorDepth / 2 - 0.2 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    },
  ]
}

function buildWallLayout(sizes: Array<{ width: number; height: number }>) {
  if (sizes.length === 3) {
    const centerWidth = sizes[1].width
    return [
      {
        position: { x: -centerWidth / 2, y: 1.3, z: sizes[0].width / 2 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
      },
      {
        position: { x: 0, y: 1.3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      {
        position: { x: centerWidth / 2, y: 1.3, z: sizes[2].width / 2 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
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
