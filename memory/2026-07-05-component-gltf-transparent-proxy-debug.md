# Component GLTF Transparent Proxy Debug - 2026-07-05

## Symptom

The user reported that a black/gray sheet rendered inside the 3D scene. The selected browser screenshot showed the sheet covering a wall-mounted component and the wall surface. The user clarified that the sheet came from the component model material and was intended to be transparent.

## Root Cause

The built-in cat-wall GLB assets contain a parent proxy mesh that carries the component children. That proxy mesh uses the material named `材质.002`.

Inspection of the GLB JSON chunks showed that `材质.002` is exported without `alphaMode`, opacity, base color, or alpha texture metadata. Three.js therefore loaded it as an ordinary visible material instead of an invisible/transparent proxy material.

## Fix

Added `src/features/scene3d/componentGltfMaterials.ts`.

The GLTF scene preparation now:

- Keeps normal component meshes casting and receiving shadows.
- Detects only the proxy pattern: mesh has children, material name is `Material.002` or `材质.002`, material is still opaque, and it has no color/alpha map.
- Clones that material, then sets it to invisible rendering (`transparent = true`, `opacity = 0`, `depthWrite = false`, `colorWrite = false`) so it stays raycastable but does not draw or occlude the scene.

`SceneCanvas.tsx` now calls `prepareComponentGltfScene(scene)` from `normalizeGltfScene()`.

## Evidence

- `npm run test -- componentGltfMaterials`: passed, 3 tests.
- `npm run test`: passed, 11 files and 65 tests.
- `npm run build`: passed. The existing Vite chunk size warning remains.
- In-app browser at `http://localhost:5173/`: canvas rendered, no console errors.
- Visual screenshot check: the previous black/gray proxy sheet no longer appears over the component/wall.

## Regression Test

`src/features/scene3d/componentGltfMaterials.test.ts`

Coverage:

- Proxy material is made invisible without mutating the original cached material.
- Ordinary meshes with the same material name but no child proxy role remain visible.
- Visible component meshes still receive shadow preparation.

## Status

DONE
