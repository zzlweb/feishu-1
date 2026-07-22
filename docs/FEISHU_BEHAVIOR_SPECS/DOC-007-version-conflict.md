# DOC-007 — Version conflict recovery

## User goal

Avoid silently losing edits when two tabs or users save the same document.

## Expected behavior

- Every update includes the client's current `base_version`.
- A matching write increments the document version.
- A stale write receives HTTP 409 with the latest server document and does not mutate storage.
- The client stops the save queue, displays a persistent conflict action and keeps the unsaved patch in local draft storage.
- Reloading fetches the latest server version and offers the local draft for save or discard.

## Regression coverage

- `server/tests/api.test.ts`
- `client/tests/document-shell-ux.spec.ts`
