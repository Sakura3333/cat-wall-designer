# Editor Panel, Thumbnail, and Wall Layout Debug - 2026-07-07

## Symptoms

The user reported five editor issues from browser comments:

- The shortcut hint panel was too large and affected other bottom panels.
- The component strip should scroll horizontally with the default mouse wheel.
- Built-in 3D thumbnails were not displaying correctly.
- The component panel needed a horizontally scrollable subcategory tab row.
- Resizing/rotating walls stretched textures, caused walls to exceed the floor, and left adjacent wall edges misaligned.

## Root Cause

- The shortcut bar was another large floating panel at the bottom and wrapped into multiple rows.
- The component palette only filtered by placement group and did not surface existing catalog subcategories.
- The horizontal component strip relied on native horizontal scroll only, so vertical wheel input did not move it.
- Thumbnail models have an original GLB center far from the asset origin. The thumbnail applied centering offset and preview rotation on the same object, so rotation moved the centered model back out of camera view. The camera also needed an explicit look-at target.
- Wall plane updates only patched the selected plane. Template side walls and the floor were not reflowed after width/height/rotation/position changes.
- Plane textures were mapped with 0-1 UVs, so resizing stretched the visual texture instead of tiling it.

## Fix

- Added a compact fixed shortcut bar at the viewport bottom.
- Added palette subcategory tabs from the existing catalog subcategory store.
- Added vertical-wheel-to-horizontal scrolling on subcategory tabs and the component strip.
- Fixed thumbnail camera orientation and split model centering from preview rotation.
- Added visible-renderable GLB bounds that exclude invisible proxy meshes for thumbnail/model centering.
- Added `planeLayout` helpers to reflow template wall hinges and refit floor bounds after wall changes.
- Routed plane size/transform history through the same reflow path so undo/redo preserves bound component movement.
- Replaced wall/floor image texture rendering with deterministic procedural textures that repeat based on physical plane dimensions.

## Evidence

- `npm run test`: passed, 16 files and 100 tests.
- `npm run build`: passed. Existing Vite chunk-size warning remains.
- In-app browser at `http://localhost:5173/` confirmed:
  - shortcut bar is fixed at bottom with 8px bottom gap and 35px height;
  - component strip has horizontal overflow;
  - subcategory row shows `全部 / 攀爬结构 / 墙面装饰 / 窗口遮挡`;
  - 11 asset thumbnail canvases render, and the first three built-in models are visible in the component panel.

## Regression Tests

- `src/domain/geometry/wallTemplates.test.ts`
  - side wall hinges remain aligned after main wall resize;
  - side wall rotation preserves the shared hinge;
  - floor bounds refit moved template walls.
- `src/features/scene3d/componentGltfMaterials.test.ts`
  - renderable bounds exclude invisible proxy meshes.

## Status

DONE
