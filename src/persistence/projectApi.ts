import type { Project } from '../domain/scene/types'
import { loadBlob, sourceImageBlobKey } from './indexedDb'
import { deserializeProject, serializeProject } from './serializers'

const LATEST_PROJECT_ID_KEY = 'cat-wall-project:latest-id'

export async function createProject(project: Project) {
  saveProjectToStorage(project)
  return project
}

export async function loadProject(id: string) {
  const value = localStorage.getItem(projectKey(id))
  return value ? restoreProjectAssets(deserializeProject(value)) : null
}

export async function updateProject(project: Project) {
  saveProjectToStorage(project)
  return project
}

export async function loadLatestProject() {
  const id = localStorage.getItem(LATEST_PROJECT_ID_KEY)
  return id ? loadProject(id) : null
}

function saveProjectToStorage(project: Project) {
  localStorage.setItem(projectKey(project.id), serializeProject(project))
  localStorage.setItem(LATEST_PROJECT_ID_KEY, project.id)
}

function projectKey(id: string) {
  return `cat-wall-project:${id}`
}

async function restoreProjectAssets(project: Project): Promise<Project> {
  if (!project.sourceImage) return project

  const blob = (await loadBlob(sourceImageBlobKey(project.id)).catch(() => undefined)) ?? (await loadBlob('latest-source-image').catch(() => undefined))
  if (!blob) return project
  const restoredUrl = URL.createObjectURL(blob)

  return {
    ...project,
    sourceImage: {
      ...project.sourceImage,
      url: restoredUrl,
    },
    planes: project.planes.map((plane) => ({
      ...plane,
      textureUrl: plane.textureUrl ? restoredUrl : plane.textureUrl,
    })),
  }
}
