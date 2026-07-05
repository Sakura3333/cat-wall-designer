# DEBUG REPORT

- **Symptom:** Wall-bound components moved with their wall, but appeared partially embedded in the wall body.
- **Root cause:** Bound component migration preserved stale/local anchor depth values such as `0` or `0.02`, while the rendered wall mesh is 0.1m thick and its visible room-facing wall surface is local `z = +0.05`. Positioning from the centerline missed half the wall thickness.
- **Fix:** Wall placement, transform constraints, wall movement migration, and stale project repair now normalize wall anchors to the visible wall surface before computing the component center. Preview tests were updated so drag feedback and committed transforms use the same surface anchor.
- **Evidence:** Added/updated regression coverage in `src/domain/scene/componentPlacement.test.ts`, `src/editor/editorStore.test.ts`, and `src/features/scene3d/componentTransformPreview.test.ts`. `npm run test` passes with 9 files and 57 tests. `npm run build` passes with the existing Vite chunk-size warning.
- **Browser verification:** Reloaded `http://localhost:5173/`; the existing wall components were visibly moved out to the wall surface instead of being embedded.
- **Status:** DONE
