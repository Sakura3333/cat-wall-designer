# Component Transform Preview Debug

Date: 2026-07-05

## Symptom

Dragging a bound wall/floor component along the plane normal with TransformControls could visually move it away from its contact surface during the drag.

## Root Cause

The placement constraint was only applied after `TransformControls.onMouseUp()` committed the transform through `editorStore.updateComponentTransform()`. During `TransformControls.onObjectChange()`, the Three.js mesh was left at the raw, unconstrained preview position.

## Fix

- Added `src/features/scene3d/componentTransformPreview.ts`.
- `SceneCanvas` now calls `applyConstrainedComponentTransformPreview()` from `TransformControls.onObjectChange`.
- The preview helper reuses `constrainComponentTransform()` so real-time drag preview and final store commit share the same placement rules.

## Evidence

- `npm run test`: 5 test files, 36 tests passed.
- `npm run build`: passed with the existing Vite chunk-size warning.

## Regression Test

`src/features/scene3d/componentTransformPreview.test.ts` simulates a Three.js `Object3D` being moved along the normal direction and verifies it is immediately projected back to the wall/floor contact surface.

## Related

Recent placement work:
- `334a5b8 feat: constrain component transforms`
- `4064f65 test: cover component boundary clamping`
- `95adc0c feat: place components on contact surfaces`

## Status

DONE
