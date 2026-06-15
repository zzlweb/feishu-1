# Document Editor Components

Reusable document-editor pieces are grouped by behavior:

- `menus`: block context menu, slash menu, insert-below flows, template picker.
- `toolbars`: editor toolbar, selection bubble, table selection toolbar.
- `panels`: color, emoji, column count, button action, and shared panel actions.
- `tables`: Feishu table schema, overlay, DOM helpers, table menus and insertion.
- `media`: image toolbars, image menus, crop overlay, upload registry.
- `blocks`: block IDs, drag/indent helpers, columns, comments, headings, formula blocks.
- `shared`: floating-position and anchored panel utilities.

Use `components/DocumentEditor` for public imports. The legacy
`components/Editor/*` files remain compatibility wrappers.
