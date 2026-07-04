import type { PlaneSpec, Project } from './types'

export function getSelectedPlane(project: Project, selectedId: string | null): PlaneSpec | null {
  if (!selectedId) return project.planes.find((plane) => plane.type === 'wall') ?? null
  return project.planes.find((plane) => plane.id === selectedId) ?? null
}
