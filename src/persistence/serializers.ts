import type { Project } from '../domain/scene/types'

export const PROJECT_SCHEMA_VERSION = 1

type SerializedProjectEnvelope = {
  schema: 'cat-wall-project'
  version: number
  project: Partial<Project>
}

export function serializeProject(project: Project) {
  return JSON.stringify(
    {
      schema: 'cat-wall-project',
      version: PROJECT_SCHEMA_VERSION,
      project: normalizeProject(project),
    } satisfies SerializedProjectEnvelope,
    null,
    2,
  )
}

export function deserializeProject(value: string): Project {
  const parsed = JSON.parse(value) as unknown
  if (isProjectEnvelope(parsed)) return normalizeProject(parsed.project)
  return normalizeProject(parsed as Partial<Project>)
}

export function normalizeProject(project: Partial<Project>): Project {
  const draft = project ?? {}
  return {
    id: typeof draft.id === 'string' && draft.id.trim() ? draft.id : 'local-draft',
    name: typeof draft.name === 'string' && draft.name.trim() ? draft.name : '本地草稿',
    sourceImage: draft.sourceImage ?? null,
    corners: Array.isArray(draft.corners) ? draft.corners : [],
    ruler: draft.ruler ?? null,
    perspectiveGuides: Array.isArray(draft.perspectiveGuides) ? draft.perspectiveGuides : [],
    perspectiveCalibration: draft.perspectiveCalibration ?? null,
    sceneCamera: draft.sceneCamera ?? null,
    polygons: Array.isArray(draft.polygons) ? draft.polygons : [],
    planes: Array.isArray(draft.planes) ? draft.planes : [],
    components: Array.isArray(draft.components)
      ? draft.components.map((component) => {
          const fallbackKind = component.kind || 'unknown-component'
          return {
            ...component,
            kind: fallbackKind,
            name: component.name || fallbackKind,
            scale: component.scale ?? { x: 1, y: 1, z: 1 },
            params: component.params ?? {},
          }
        })
      : [],
    settings: {
      showFloor: draft.settings?.showFloor ?? true,
      sketchBackground: draft.settings?.sketchBackground ?? true,
    },
  }
}

function isProjectEnvelope(value: unknown): value is SerializedProjectEnvelope {
  if (!value || typeof value !== 'object') return false
  const envelope = value as SerializedProjectEnvelope
  return envelope.schema === 'cat-wall-project' && typeof envelope.version === 'number' && envelope.project !== null && typeof envelope.project === 'object'
}
