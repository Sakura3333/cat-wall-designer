export const SCENE_SELECTION_CLICK_THRESHOLD_PX = 4

export function isSceneSelectionClick(delta: number, threshold = SCENE_SELECTION_CLICK_THRESHOLD_PX) {
  return Number.isFinite(delta) && Math.abs(delta) <= threshold
}
