# DOC-006 — Route request isolation

## User goal

Switch quickly between documents without a slower previous request replacing the current document.

## Expected behavior

- Every document and comment load belongs to the route ID that started it.
- Navigating aborts the previous route's in-flight requests.
- A response that still completes after abort is ignored by request sequence identity.
- Loading state is cleared only by the latest request.
- A stale failure must not redirect the current route back to the home page.

## Regression coverage

- `client/tests/document-shell-ux.spec.ts`
