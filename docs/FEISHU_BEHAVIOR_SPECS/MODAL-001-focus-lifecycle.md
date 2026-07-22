# MODAL-001 — Record modal focus lifecycle

## User goal

Inspect and edit a record without keyboard focus escaping behind the modal, then continue from the same place after closing it.

## Expected behavior

- Opening the record modal moves focus into the dialog.
- `Tab` and `Shift+Tab` cycle through the dialog and its owned date, attachment and select popovers.
- `Escape`, the close button and mask dismissal close the dialog.
- Closing restores focus to the connected element that opened the dialog.
- Navigating to the previous or next record does not overwrite the original return target.

## Regression coverage

- `client/tests/bitable-record-modal.spec.ts`
