# Cat Wall Designer

Cat Wall Designer is a Vite + React + TypeScript prototype for turning an indoor photo or a quick wall template into an editable 3D cat-wall scene.

The current editor supports perspective guide lines, wall templates, thick wall and floor geometry, component catalog management, and placeholder component placement. The next major development track is realistic wall/floor/free component placement.

## Quick Start

```bash
npm install
npm run dev -- --port 5173
```

Open the editor at:

```txt
http://127.0.0.1:5173/
```

Open the component manager at:

```txt
http://127.0.0.1:5173/components_manager
```

## Scripts

```bash
npm run dev
npm run build
npm run test
npm run test:watch
npm run preview
```

## Project Map

- `src/editor/` - editor shell and Zustand state.
- `src/domain/geometry/` - pure geometry, perspective, UV, and validation helpers.
- `src/domain/scene/` - scene types, component catalog, selection helpers, and wall templates.
- `src/features/annotation/` - 2D image marking layer.
- `src/features/scene3d/` - React Three Fiber scene renderer.
- `src/features/components-manager/` - editable component catalog page.
- `src/persistence/` - local draft persistence placeholders.
- `3dAssets/` - source GLB/Blend component assets.
- `docs/` - development specs and handoff documents.

## Recommended Reading

1. `docs/cat-wall-editor-dev-spec.md`
2. `docs/cat-wall-editor-handoff.md`
3. `docs/cat-wall-component-system-handoff-2026-07-04.md`
4. `docs/perspective-camera-match.md`

## Verification

Before committing changes, run:

```bash
npm run test
npm run build
```
