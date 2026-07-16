# 2026-07-07 Construction SVG Export Style Debug

## Symptom

Downloaded construction drawing SVG files rendered component rectangles as black blocks in standalone viewers.

## Root Cause

The construction drawing page styled most SVG shapes through external CSS classes. `downloadAllSheetSvgs()` cloned and serialized the live `<svg>` node, but the standalone SVG file did not include the app stylesheet. SVG elements such as component `<rect>` nodes then fell back to the SVG default `fill: black`.

## Fix

- `ConstructionSheetSvg` now emits a stable `data-sheet-id` so export can deduplicate sheets.
- `downloadAllSheetSvgs()` prefers the print-only sheet SVGs and falls back to unique preview sheets.
- SVG export now copies computed presentation styles (`fill`, `stroke`, text styles, opacity, etc.) onto cloned SVG elements before serialization.

## Evidence

- Browser page inspection confirmed live component rects had computed fill/stroke but no inline style before export.
- Regression test covers `downloadAllSheetSvgs()` and asserts exported SVG text contains inline component fill/stroke/stroke-width.
- `npm run test`: 16 files, 96 tests passed.
- `npm run build`: passed. Existing Vite large chunk warning remains.

## Status

DONE
