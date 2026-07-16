# Cat Wall Designer

Cat Wall Designer is a Vite + React + TypeScript prototype for turning an indoor photo or a quick wall template into an editable 3D cat-wall scene.

The current editor supports perspective guide lines, wall templates, thick wall and floor geometry, real GLB/component catalog workflows, wall/floor/free placement constraints, forbidden zones, distance measurements, construction drawings, and BOM price summaries. The current product direction is an internal design and delivery tool for cat-wall projects, with commercialization work focused on SKU, quote, project, and construction package workflows.

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

Open the construction drawings page at:

```txt
http://127.0.0.1:5173/construction_drawings
```

Open the AI CAD calibration page at:

```txt
http://127.0.0.1:5173/components_manager/ai-cad
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
- `src/domain/scene/` - scene types, component catalog/assets, placement, footprints, forbidden zones, measurements, and construction drawing builders.
- `src/domain/ai-cad/` - AI CAD schema, calibration, sketch, and modeling-plan domain helpers.
- `src/features/annotation/` - 2D image marking layer.
- `src/features/scene3d/` - React Three Fiber scene renderer.
- `src/features/components-manager/` - editable component catalog page.
- `src/features/construction-drawings/` - construction drawing preview/export and BOM table.
- `src/features/ai-cad-agent/` - AI CAD calibration workflow.
- `src/persistence/` - local draft persistence, IndexedDB image cache, and project serializers.
- `workers/` - local CAD worker prototype code.
- `schemas/` and `fixtures/` - AI CAD schema and golden/sample fixture assets.
- `3dAssets/` - source GLB/Blend component assets.
- `docs/` - development specs and handoff documents.

## Recommended Reading

1. `docs/cat-wall-editor-handoff-2026-07-16.md`
2. `docs/construction-drawings-feature-design-2026-07-07.md`
3. `docs/cat-wall-editor-commercialization-plan-2026-07-09.md`
4. `docs/cat-wall-editor-commercialization-task-breakdown-2026-07-11.md`
5. `docs/ai-cad-agent-pipeline-design-2026-07-11.md`
6. `docs/ai-cad-parametric-sketch-editor-design-2026-07-12.md`
7. `docs/cat-wall-editor-dev-spec.md`
8. `docs/cat-wall-component-system-handoff-2026-07-04.md`
9. `docs/perspective-camera-match.md`

## Verification

Before committing changes, run:

```bash
npm run test
npm run build
```
