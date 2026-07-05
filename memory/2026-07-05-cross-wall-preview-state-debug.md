# Cross Wall Preview State Debug

Date: 2026-07-05

## Symptom

Dragging a wall component repeatedly between two walls could leave the preview with the wrong orientation. The component might visually stay attached to one wall while keeping the rotation from the other wall.

## Root Cause

`TransformControls.onObjectChange` called `applyConstrainedComponentTransformPreview()` with `selectedComponent` from the Zustand store every frame. During a drag, the store is not updated until mouseup, so every preview frame used the original wall attachment as its baseline. After one frame reattached the object to another wall, the next frame did not know about that preview attachment and could preserve stale rotation when moving back.

## Fix

- `applyConstrainedComponentTransformPreview()` now returns the constrained preview `SceneComponent`.
- `SceneCanvas` stores that returned preview component in a ref during the drag.
- Each `onObjectChange` constrains against the latest preview attachment, not the stale store component.
- The preview ref resets when selection changes or the transform is committed.

## Evidence

- `npm run test`: 5 test files, 40 tests passed.
- `npm run build`: passed with the existing Vite chunk-size warning.

## Regression Test

`src/features/scene3d/componentTransformPreview.test.ts` now simulates moving one component from wall A to wall B, then back to wall A during the same drag. The final preview position and rotation are both projected back to wall A.

## Status

DONE
