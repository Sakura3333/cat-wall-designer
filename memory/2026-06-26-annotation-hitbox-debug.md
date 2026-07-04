# Annotation Hitbox Debug Report

- Date: 2026-06-26
- Symptom: First corner marks appeared at image origin/edges instead of the mouse click position.
- Root cause: The annotation layer was larger than the actual rendered image. `object-fit: contain` letterboxed the image inside a larger safe area, while click coordinates were converted against the larger safe area and clamped into image bounds.
- Fix: Keep the safe area as the outer layer, compute the contained image rectangle, and render an `.annotation-hitbox` exactly over the displayed image. Pointer events and point rendering now use the hitbox dimensions.
- Evidence: `npm run build` passes. Browser refresh has no console errors.
- Verification gap: The automated browser session did not retain an uploaded image, so full click-path reproduction was not available in the current state.
