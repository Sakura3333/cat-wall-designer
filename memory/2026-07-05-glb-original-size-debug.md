# GLB original size debug - 2026-07-05

## Symptom

User reported that loaded component models should not be stretched and should be placed with their original size and proportions.

## Root cause

Commit `5c2cf4a` introduced GLB rendering in `SceneCanvas`. `normalizeGltfScene()` fit each GLB into the catalog `defaultSize` using independent X/Y/Z scale factors. That non-uniform scaling visually stretched models and made the displayed model proportions differ from the authored GLB.

## Fix

- Added intrinsic `size` metadata for built-in GLB assets in `src/domain/scene/componentAssets.ts`.
- Catalog normalization now uses built-in asset size for placement sizing when an asset key resolves to an internal GLB.
- GLB rendering now only centers the model and uses scale `{ x: 1, y: 1, z: 1 }`, preserving original authored dimensions and proportions.
- Updated editor store tests that previously asserted old placeholder box dimensions.

## Evidence

- `npm run test`: 6 files, 49 tests passed.
- `npm run build`: passed with the existing Vite chunk-size warning.

## Regression test

- `src/domain/scene/componentAssets.test.ts` checks that original asset transform keeps scale at `1,1,1`.
- `src/editor/editorStore.test.ts` checks that wall placement uses the intrinsic GLB size for the default cat shelf asset.

## Status

DONE_WITH_CONCERNS: Browser-side visual verification was not repeated because browser automation for the localhost target was blocked by the Browser safety policy in this session.
