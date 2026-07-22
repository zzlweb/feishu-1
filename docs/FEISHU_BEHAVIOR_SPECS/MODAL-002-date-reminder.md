# MODAL-002 — Date reminder capability boundary

## Decision

The record date picker does not expose an “到期提醒” switch until reminders have a persisted data model and delivery path.

## Expected behavior

- Users can choose and persist a date normally.
- The picker does not suggest that a reminder will be saved or delivered.
- A reminder control may return only with storage, scheduling, delivery status and failure recovery.

## Regression coverage

- `client/tests/bitable-record-modal.spec.ts`
