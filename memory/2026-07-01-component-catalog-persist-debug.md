# 2026-07-01 component catalog persist debug

## Symptom

`/components_manager` white-screened after adding `purchaseUrls` and `referencePrice`.

Runtime error:

```txt
Uncaught TypeError: Cannot read properties of undefined (reading 'length')
ComponentsManagerPage.tsx
```

## Root Cause

`purchaseUrls` was added as a required array field on `ComponentCatalogItem`, but existing browser `localStorage` data was already persisted with catalog store version `2`.

Because the store version was not bumped when the field was added, Zustand did not run `migrate`. The app rehydrated old component objects without `purchaseUrls`, and the component list rendered `component.purchaseUrls.length`, causing a null/undefined propagation crash.

## Fix

- Bumped `cat-wall-component-catalog` persist version to `3`.
- Added a `merge` function to normalize persisted `components` and `subcategories` on every rehydrate, even when a future version does not require `migrate`.
- Added a defensive UI fallback: `(component.purchaseUrls ?? []).length`.

## Verification

`npm run build` passed after the fix.

## Lesson

When adding non-optional fields to persisted Zustand state, either:

- bump persist version and migrate old data, and
- normalize during merge so stale persisted objects cannot enter the runtime shape.
