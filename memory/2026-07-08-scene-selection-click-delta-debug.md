# DEBUG REPORT: Scene Selection After Orbit Drag

- **Symptom:** Dragging the 3D view to rotate could select the model under the mouse-up position, replacing the previously selected model.
- **Root cause:** Scene object selection in `SceneCanvas.tsx` was handled directly in R3F `onClick` handlers without checking pointer travel. Orbit drag gestures could still produce click selection events on the object below the release point.
- **Fix:** Added `isSceneSelectionClick` with a 4px pointer delta threshold and routed plane, forbidden-zone, and component click selection through that guard. Locked forbidden zones now also select on thresholded click rather than pointer down.
- **Regression test:** Added `src/features/scene3d/sceneSelection.test.ts` to cover accepted small clicks, rejected drag deltas, and invalid deltas.
- **Evidence:** `npm run test` passed with 17 files and 110 tests. `npm run build` passed; Vite still reports the existing large chunk warning. Browser verification selected a component, dragged the view with mouse-up near another component, and confirmed the property panel coordinates stayed `-0.37, 1.44, 0.16`.
- **Status:** DONE
