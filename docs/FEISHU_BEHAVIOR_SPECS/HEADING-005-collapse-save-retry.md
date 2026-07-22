# HEADING-005 — Collapse save retry

## User goal

Keep a heading collapsed when the first persistence attempt fails.

## Expected behavior

- Toggling a heading updates the document immediately.
- A failed `collapsed_heading_ids` update remains queued and is copied to local draft storage.
- The header keeps a persistent **保存失败** action instead of reverting the collapse.
- Clicking the action resends the same collapsed heading IDs with the same version until a write succeeds.
- Success clears the draft and returns the header to **已保存**.

## Regression coverage

- `client/tests/heading-id-uniqueness.spec.ts`
