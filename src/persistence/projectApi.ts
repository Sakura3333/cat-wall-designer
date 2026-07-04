import type { Project } from '../domain/scene/types'

export async function createProject(project: Project) {
  localStorage.setItem(projectKey(project.id), JSON.stringify(project))
  return project
}

export async function loadProject(id: string) {
  const value = localStorage.getItem(projectKey(id))
  return value ? (JSON.parse(value) as Project) : null
}

export async function updateProject(project: Project) {
  localStorage.setItem(projectKey(project.id), JSON.stringify(project))
  return project
}

function projectKey(id: string) {
  return `cat-wall-project:${id}`
}
