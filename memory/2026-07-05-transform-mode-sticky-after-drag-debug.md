# Transform Mode Sticky After Drag Debug - 2026-07-05

## Symptom

The user reported that after moving or rotating an object in the 3D scene, the editor immediately switched back to select mode. The desired behavior is that move/rotate mode remains active after the drag ends, and the user switches back to select explicitly with the select tool or `Q`.

## Root Cause

`SceneCanvas.tsx` wired `TransformControls.onMouseUp` to both commit the selected transform and call `setTransformMode('select')`. That made transform modes one-shot tools.

## Fix

Changed `TransformControls.onMouseUp` to call only `commitSelectedTransform`.

Manual mode changes remain controlled by:

- Select toolbar button.
- `Q` shortcut.
- Existing `Escape` behavior, which also clears selection and sets select mode.

## Evidence

- `npm run build`: passed. Existing Vite chunk size warning remains.
- `npm run test`: passed, 11 files and 66 tests.
- In-app browser at `http://localhost:5173/`: page rendered with one canvas and no console errors.
- Browser verification:
  - Clicked move tool.
  - Dragged the visible transform gizmo.
  - After mouse up, toolbar and shortcut bar still reported `W` / move as active.
  - Clicked select tool and verified select became active.
  - Undid the test drag to avoid leaving project geometry changed.

## Regression Coverage

No new automated test was added because this behavior lives inside Drei `TransformControls` pointer interaction. It was verified with the in-app browser against the running app.

## Status

DONE
