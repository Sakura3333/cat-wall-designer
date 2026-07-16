import { describe, expect, it } from 'vitest'
import { SCENE_SELECTION_CLICK_THRESHOLD_PX, isSceneSelectionClick } from './sceneSelection'

describe('isSceneSelectionClick', () => {
  it('accepts clicks whose pointer-up stays within the small movement threshold', () => {
    expect(isSceneSelectionClick(0)).toBe(true)
    expect(isSceneSelectionClick(SCENE_SELECTION_CLICK_THRESHOLD_PX)).toBe(true)
  })

  it('rejects drag gestures that travel beyond the selection threshold', () => {
    expect(isSceneSelectionClick(SCENE_SELECTION_CLICK_THRESHOLD_PX + 0.1)).toBe(false)
    expect(isSceneSelectionClick(18)).toBe(false)
  })

  it('rejects invalid pointer deltas instead of selecting accidentally', () => {
    expect(isSceneSelectionClick(Number.NaN)).toBe(false)
    expect(isSceneSelectionClick(Number.POSITIVE_INFINITY)).toBe(false)
  })
})
