# MEDIA-002 — Upload failure recovery

## User goal

Recover an image or file block after upload fails, including after the document is refreshed.

## Expected behavior

- A failed upload remains as a block with the original name, error and local preview when available.
- While the original `File` remains in memory, **重试** restarts upload in place.
- **移除** deletes a failed image block without leaving an empty paragraph artifact.
- After refresh, the browser no longer has the original file. The action changes to **重新选择** instead of pretending retry can work.
- Selecting a replacement file reuses the existing block and upload ID, then returns it to normal uploading/success states.

## Regression coverage

- `client/tests/media-file-blocks.spec.ts`
