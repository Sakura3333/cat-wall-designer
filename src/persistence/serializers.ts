import type { Project } from '../domain/scene/types'

export function serializeProject(project: Project) {
  return JSON.stringify(project)
}

export function deserializeProject(value: string): Project {
  return JSON.parse(value) as Project
}
