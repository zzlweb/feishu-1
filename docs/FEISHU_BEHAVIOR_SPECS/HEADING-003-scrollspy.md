# HEADING-003 — Catalogue scrollspy

## User goal

Understand the current section while reading a long document without placing the text cursor.

## Expected behavior

- Workspace scrolling updates the active catalogue item from a reading anchor near the upper quarter of the viewport.
- The active item is the last visible heading that has crossed the anchor.
- Collapsed or otherwise hidden heading elements do not become active.
- Before the first heading crosses the anchor, the document-title entry remains active when present.
- Scroll updates are coalesced through `requestAnimationFrame` to avoid layout thrashing.

## Regression coverage

- `client/tests/catalogue-sticky-layout.spec.ts`
