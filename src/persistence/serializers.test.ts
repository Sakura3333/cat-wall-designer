import { describe, expect, it } from 'vitest'
import type { Project } from '../domain/scene/types'
import { PROJECT_SCHEMA_VERSION, deserializeProject, serializeProject } from './serializers'

const baseProject: Project = {
  id: 'project-1',
  name: 'Saved project',
  sourceImage: { url: 'blob:source-image', width: 1200, height: 800 },
  corners: [],
  ruler: null,
  perspectiveGuides: [],
  perspectiveCalibration: null,
  sceneCamera: null,
  polygons: [],
  planes: [],
  components: [],
  settings: {
    showFloor: true,
    sketchBackground: true,
  },
}

describe('project serializers', () => {
  it('wraps project JSON in a versioned envelope', () => {
    const serialized = serializeProject(baseProject)
    const envelope = JSON.parse(serialized)

    expect(envelope).toMatchObject({
      schema: 'cat-wall-project',
      version: PROJECT_SCHEMA_VERSION,
      project: {
        id: 'project-1',
        name: 'Saved project',
      },
    })
    expect(deserializeProject(serialized)).toEqual(baseProject)
  })

  it('reads legacy raw project JSON and applies runtime defaults', () => {
    const legacyProject = {
      id: 'legacy-project',
      name: '',
      sourceImage: null,
      components: [],
    }

    expect(deserializeProject(JSON.stringify(legacyProject))).toMatchObject({
      id: 'legacy-project',
      name: '本地草稿',
      planes: [],
      components: [],
      settings: {
        showFloor: true,
        sketchBackground: true,
      },
    })
  })

  it('preserves instance component fallbacks when a catalog kind no longer exists', () => {
    const restored = deserializeProject(
      JSON.stringify({
        ...baseProject,
        components: [
          {
            id: 'component-1',
            kind: 'deleted-catalog-kind',
            name: 'Saved custom shelf',
            position: { x: 0.2, y: 1.4, z: 0.1 },
            rotation: { x: 0, y: 0.25, z: 0 },
            size: { x: 0.7, y: 0.4, z: 0.2 },
            material: { color: '#c0ffee' },
          },
        ],
      }),
    )

    expect(restored.components[0]).toMatchObject({
      kind: 'deleted-catalog-kind',
      name: 'Saved custom shelf',
      size: { x: 0.7, y: 0.4, z: 0.2 },
      material: { color: '#c0ffee' },
      scale: { x: 1, y: 1, z: 1 },
      params: {},
    })
  })
})
