# DEBUG REPORT

- **Symptom:** Default corner/three-wall layouts showed thick wall intersections; components bound to a wall did not move with that wall; placement feedback stayed visible and occupied too much editor space.
- **Root cause:** Wall layout centers ignored the 0.1m visual wall thickness; `updatePlaneTransform` only updated plane transforms and left bound component anchors/positions unchanged; `PlacementFeedbackStrip` had no expiry timer and used a full-width notification layout.
- **Fix:** Offset corner wall centers by half wall thickness in template and polygon-derived three-wall layouts; added bound-component plane transform helpers so plane moves/undo/redo carry attached components; project load now reprojects stale bound components back onto their target plane surface; placement feedback auto-dismisses and uses smaller typography/layout.
- **Evidence:** Added failing regression coverage first for wall tangency and bound component plane transforms, then verified `npm run test` passes with 9 files and 56 tests. `npm run build` passes with the existing Vite chunk-size warning.
- **Browser verification:** Reloaded `http://localhost:5173/`; the existing stale local draft reprojected left-wall components back onto the wall, and no placement feedback strip remained visible after refresh.
- **Regression tests:** `src/domain/geometry/buildPlanes.test.ts`, `src/domain/geometry/wallTemplates.test.ts`, `src/domain/scene/componentPlacement.test.ts`, `src/editor/editorStore.test.ts`.
- **Status:** DONE
