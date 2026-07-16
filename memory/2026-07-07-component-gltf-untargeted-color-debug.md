# Component GLTF Untargeted Color Debug - 2026-07-07

## Symptom

The user reported that every dragged built-in model except the first cat shelf rendered like a white/plain material in the 3D scene, while the same assets looked correctly textured in the component palette thumbnails.

## Root Cause

The scene render path calls `applyComponentModelParamEffects()` after `prepareComponentGltfScene()`. Most built-in GLB catalog items define a color property with `modelBinding: { kind: 'material-color' }` and no `target`.

`applyMaterialColor()` treated a missing target as "match every visible mesh", so the scene cloned and recolored every GLB material to the catalog default color. Those defaults are pale wood colors, which made the real model materials look like white/plain meshes.

The thumbnail path only calls `prepareComponentGltfScene()` and never applies model params, so thumbnails kept the original GLB materials.

## Fix

Updated `src/features/scene3d/componentGltfMaterials.ts`.

GLB material recoloring now requires an explicit `modelBinding.target`. Untargeted color properties can still drive fallback boxes and UI swatches through the domain-level color resolver, but they no longer overwrite all real GLB mesh materials in the scene.

## Evidence

- Added a failing regression test first; it proved untargeted color params cloned and recolored all GLB mesh materials.
- `npm run test -- componentGltfMaterials`: passed, 8 tests.
- `npm run test`: passed, 16 files and 101 tests.
- `npm run build`: passed. Vite still reports the existing chunk-size warning for the main bundle.
- In-app browser at `http://localhost:5173/`: after reload, existing non-cat-shelf models such as three-step platforms, ladders, and cat houses retained their original visible material variation instead of rendering as plain white/pale meshes.

## Regression Test

`src/features/scene3d/componentGltfMaterials.test.ts`

Added coverage that a `material-color` binding without a target preserves original GLB mesh materials and does not clone/recolor them.

## Related

This is in the same area as `memory/2026-07-05-component-gltf-transparent-proxy-debug.md`. That earlier issue handled exported transparent proxy meshes; this issue was caused by catalog param effects overwriting valid visible GLB materials.

## Status

DONE
