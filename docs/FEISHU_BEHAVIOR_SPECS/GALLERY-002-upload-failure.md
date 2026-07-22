# GALLERY-002 — Drop upload failure recovery

## User goal

Create a Gallery card by dropping files without leaving an unusable empty record when upload fails.

## Expected behavior

- Dropping files on the Gallery background creates one temporary record for the batch.
- Every upload reaches success or a terminal failure state, including HTTP, network, abort and timeout failures.
- If every file in a newly created batch fails, the temporary record is removed automatically.
- If at least one file succeeds, the record remains.
- Uploading to an existing record never deletes that record; its failed attachment remains visible as recovery feedback.

## Regression coverage

- `client/tests/bitable-gallery.spec.ts`
