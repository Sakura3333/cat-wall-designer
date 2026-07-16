import { describe, expect, it } from 'vitest'
import type { ComponentPlacementMode, SceneComponent } from '../../domain/scene/types'
import { buildComponentTransformControlOptions } from './componentTransformControls'

describe('buildComponentTransformControlOptions', () => {
  it('keeps plane transforms on the unrestricted world gizmo', () => {
    expect(buildComponentTransformControlOptions(null, 'rotate')).toEqual({
      space: 'world',
      showX: true,
      showY: true,
      showZ: true,
    })
  })

  it('moves wall components on their local wall plane and rotates around the contact normal', () => {
    const component = componentWithPlacement('wall')

    expect(buildComponentTransformControlOptions(component, 'translate')).toEqual({
      space: 'local',
      showX: true,
      showY: true,
      showZ: false,
    })
    expect(buildComponentTransformControlOptions(component, 'rotate')).toEqual({
      space: 'local',
      showX: false,
      showY: false,
      showZ: true,
    })
  })

  it('moves floor components on their local floor plane and rotates around the vertical axis', () => {
    const component = componentWithPlacement('floor')

    expect(buildComponentTransformControlOptions(component, 'translate')).toEqual({
      space: 'local',
      showX: true,
      showY: false,
      showZ: true,
    })
    expect(buildComponentTransformControlOptions(component, 'rotate')).toEqual({
      space: 'local',
      showX: false,
      showY: true,
      showZ: false,
    })
  })

  it('leaves free components unrestricted', () => {
    const component = componentWithPlacement('free')

    expect(buildComponentTransformControlOptions(component, 'translate')).toEqual({
      space: 'world',
      showX: true,
      showY: true,
      showZ: true,
    })
    expect(buildComponentTransformControlOptions(component, 'rotate')).toEqual({
      space: 'world',
      showX: true,
      showY: true,
      showZ: true,
    })
  })
})

function componentWithPlacement(mode: ComponentPlacementMode): SceneComponent {
  return {
    id: `component-${mode}`,
    kind: 'test',
    name: 'Test',
    placement: { mode },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  }
}
