# Cross Wall Reattach Debug

Date: 2026-07-05

## Symptom

When a wall component was moved across walls, it kept the old wall binding and orientation instead of rotating so its local `-Z` side stayed attached to the new wall.

## Root Cause

`constrainComponentTransform()` only looked up `component.placement.targetPlaneId` and constrained movement against that original wall. It never evaluated other wall planes during movement, so `targetPlaneId`, `placement.normal`, and `rotation` could not update when the dragged object crossed to another wall.

## Fix

- Wall transform constraints now evaluate all wall planes and choose the attachment whose constrained center is closest to the dragged preview position.
- On wall retarget, the component updates `targetPlaneId`, `placement.anchor`, `placement.normal`, and `rotation`.
- The rotation is rebuilt from the new wall plane, so local `+Z` faces the wall normal and local `-Z` remains the contact/back side.
- Preview and commit paths both pass catalog `defaultRotation` into the placement constraint.

## Evidence

- `npm run test`: 5 test files, 39 tests passed.
- `npm run build`: passed with the existing Vite chunk-size warning.

## Regression Tests

- `src/domain/scene/componentPlacement.test.ts`: cross-wall reattach and rotation.
- `src/editor/editorStore.test.ts`: commit updates target plane, placement and rotation.
- `src/features/scene3d/componentTransformPreview.test.ts`: preview reattaches and rotates before mouseup.

## Status

DONE
