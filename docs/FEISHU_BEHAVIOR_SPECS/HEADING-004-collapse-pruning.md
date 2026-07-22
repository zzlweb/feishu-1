# HEADING-004 — Collapse state pruning

## User goal

Keep heading collapse state predictable after replacing or importing document content.

## Expected behavior

- Persisted collapse IDs are loaded before the editor reports its normalized heading list.
- After the first heading snapshot for the current document, IDs absent from that snapshot are removed.
- IDs that still exist remain collapsed.
- A heading snapshot from the previous route must never prune the newly loaded document.
- The cleaned list is persisted through the normal versioned save queue.

## Regression coverage

- `client/tests/heading-id-uniqueness.spec.ts`
