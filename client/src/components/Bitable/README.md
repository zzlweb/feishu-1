# Bitable Components

This folder is the public facade for reusable bitable UI.

- `views`: grid, gallery, gantt, and kanban view components.
- `fields`: field creation, field type, and select-option editors.
- `records`: record modal, record comments, and record context menus.
- `shared`: shared display helpers, headers, tooltips, and small controls.
- `model`: table, view, field, record, config, and value contracts.

Import from `components/Bitable` when building reusable callers. The existing
`components/Editor/Bitable*.tsx` paths are compatibility wrappers for the editor.
