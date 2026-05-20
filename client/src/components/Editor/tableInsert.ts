import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { getSlashRange } from './slashMenuConfig';

export const TABLE_GRID_MAX = 10;

export function deleteSlashIfAny(editor: Editor) {
  const range = getSlashRange(editor);
  if (range.from < range.to) {
    editor.chain().focus().deleteRange(range).run();
  }
}

function clampTableSize(rows: number, cols: number) {
  return {
    rows: Math.max(1, Math.min(rows, TABLE_GRID_MAX)),
    cols: Math.max(1, Math.min(cols, TABLE_GRID_MAX)),
  };
}

/** 插入支持富文本的表格（默认无标题行；可通过块菜单切换）。
 *  使用 editor.commands 直接调用，避免 chain 中 .command() 干扰 dispatch。 */
export function insertFeishuTable(editor: Editor, rows: number, cols: number, withHeaderRow = false) {
  const { rows: r, cols: c } = clampTableSize(rows, cols);
  deleteSlashIfAny(editor);
  // 安全聚焦：若 focusPlusMenuTarget 未成功，确保编辑器有焦点和合法选区
  editor.commands.focus();
  try {
    const ok = editor.commands.insertTable({ rows: r, cols: c, withHeaderRow });
    // eslint-disable-next-line no-console
    console.log('[insertFeishuTable] rows=%d cols=%d withHeaderRow=%s result=%s', r, c, withHeaderRow, ok);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[insertFeishuTable] insertTable threw:', err);
  }
}

/** 在指定位置插入表格（用于「在下方添加」） */
export function insertFeishuTableAt(editor: Editor, pos: number, rows: number, cols: number, withHeaderRow = false) {
  const { rows: r, cols: c } = clampTableSize(rows, cols);
  editor.commands.setTextSelection(pos);
  const ok = editor.commands.insertTable({ rows: r, cols: c, withHeaderRow });
  // eslint-disable-next-line no-console
  console.log('[insertFeishuTableAt] pos=%d rows=%d cols=%d result=%s', pos, r, c, ok);
}

/** 将光标移入表格指定单元格，便于执行增删行列命令 */
export function focusTableCell(editor: Editor, tablePos: number, row: number, col = 0): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return false;

  let pos = tablePos + 1;
  const safeRow = Math.max(0, Math.min(row, table.childCount - 1));
  for (let r = 0; r < safeRow; r++) {
    pos += table.child(r).nodeSize;
  }
  const rowNode = table.child(safeRow);
  const safeCol = Math.max(0, Math.min(col, rowNode.childCount - 1));
  for (let c = 0; c < safeCol; c++) {
    pos += rowNode.child(c).nodeSize;
  }

  try {
    const $cell = editor.state.doc.resolve(pos + 1);
    return editor.chain().focus().setTextSelection(TextSelection.near($cell, 1)).run();
  } catch {
    return false;
  }
}

export function insertTableRowAt(editor: Editor, tablePos: number, rowIndex: number, after = false) {
  if (!focusTableCell(editor, tablePos, rowIndex, 0)) return;
  if (after) {
    editor.chain().focus().addRowAfter().run();
  } else {
    editor.chain().focus().addRowBefore().run();
  }
}

export function getActiveTableContext(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== 'table') continue;
    return {
      tablePos: $from.before(d),
      rowIndex: $from.index(d + 1),
      colIndex: $from.index(d + 2),
    };
  }
  return null;
}

export function insertTableColumnAt(editor: Editor, tablePos: number, colIndex: number, after = false) {
  if (!focusTableCell(editor, tablePos, 0, colIndex)) return;
  if (after) {
    editor.chain().focus().addColumnAfter().run();
  } else {
    editor.chain().focus().addColumnBefore().run();
  }
}
