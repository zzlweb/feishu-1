# KANBAN-004 — Move card without dragging

## User goal

Move a card between Kanban columns when pointer dragging is inconvenient or unavailable.

## Trigger

- Right-click a card, or focus it and press `Shift+F10` / the Context Menu key.
- Choose **移动到列** and then a target column.

## Expected behavior

- The current column is identified and disabled.
- Choosing another column updates the grouped single-select field and closes the menu.
- The card immediately appears in the target column and the document save request contains the target choice ID.
- Read-only views expose no enabled move action.

## Regression coverage

- `client/tests/bitable-kanban.spec.ts`
