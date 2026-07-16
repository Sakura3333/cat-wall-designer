# Forbidden Zone Draft Pointerup Debug

Date: 2026-07-06

## Symptom

After drawing a forbidden placement zone, releasing the mouse did not always end drawing. Moving the mouse after release could keep resizing the draft, and a later click was required to exit drawing mode, sometimes creating an extra rectangle.

## Root Cause

The draft commit path relied on a global `pointerup` listener that was attached only after the `zoneDraft` state update rendered. If the release happened before that listener was active or if R3F handled the pointerup path first, the plane `pointerup` no longer committed the draft. The draft then stayed alive in React state and continued to update on later pointer moves.

## Fix

- Added the drawing `pointerId` to the draft so only the initiating pointer can update or finish it.
- Made `zoneDraftRef` the immediate source of truth for drawing start, move, and finish.
- Mounted global `pointerup`/`pointercancel` listeners for the whole component lifetime.
- Restored plane `pointerup` to call the same idempotent `finalizeZoneDraft()` path, so either event route safely commits exactly once.

## Evidence

- `npm run test`: 12 files passed, 74 tests passed.
- `npm run build`: passed; Vite reported only the existing large chunk warning.
- Browser verification on `http://localhost:5173/`: draw rectangle, release, move mouse, click blank wall. Only one rectangle was created, drawing mode returned to select, and no duplicate zone appeared.
- The QA-created test rectangle was deleted after verification; the existing zones remained.
- No new browser console errors were captured during the final verification run.

## Status

DONE
