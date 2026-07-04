# Annotation Hooks Debug Report

- Date: 2026-06-26
- Symptom: Uploading an image caused React to report a changed hook order in `AnnotationLayer`, and the app appeared blank/unusable.
- Root cause: `useMemo` was declared after `if (!project.sourceImage) return null`, so the no-image render skipped that hook while the uploaded-image render called it. The layout effect also had an empty dependency list, so it could run before the annotation DOM existed and not rerun after upload.
- Fix: Move `useMemo` before the early return and rerun the layout measurement effect when `project.sourceImage` changes.
- Evidence: `npm run build` passes. Browser reload shows the upload button and no console warnings/errors.
