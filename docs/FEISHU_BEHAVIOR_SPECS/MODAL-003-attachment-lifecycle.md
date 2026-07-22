# MODAL-003 — Record attachment lifecycle

## User goal

Recover or remove attachments directly from a record without leaving the modal.

## Expected behavior

- Every attachment row exposes a delete action in editable documents.
- An uploading attachment exposes **取消**; cancel aborts its active XHR and removes the pending value.
- A failed attachment retains its error and exposes **重新选择**.
- Selecting a replacement removes the failed value and starts a new upload in the same field.
- Read-only records show attachment state without mutation controls.

## Regression coverage

- `client/tests/bitable-record-modal.spec.ts`
