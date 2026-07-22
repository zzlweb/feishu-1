# BLOCK-003 — Block menu keyboard navigation

## User goal

Use every block-menu category without relying on hover or precise pointer movement.

## Expected behavior

- The block panel exposes `menu` semantics and actionable rows expose `menuitem` semantics.
- `ArrowUp` and `ArrowDown` move through enabled items with wrapping.
- `ArrowRight` on 缩进和对齐、颜色 or 在下方添加 opens the owned submenu and focuses its first enabled control.
- `ArrowLeft` or `Escape` in a submenu closes only that submenu and restores focus to its trigger.
- `Escape` in the root menu closes the whole block panel.

## Regression coverage

- `client/tests/block-color.spec.ts`
