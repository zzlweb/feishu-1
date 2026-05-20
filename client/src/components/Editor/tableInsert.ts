import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { getSlashRange } from './slashMenuConfig';
import { getTableElementFromHost } from './tableDom';

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

/** 插入支持富文本的表格（默认无标题行；可通过块菜单切换） */
export function insertFeishuTable(editor: Editor, rows: number, cols: number, withHeaderRow = false) {
  const { rows: r, cols: c } = clampTableSize(rows, cols);
  deleteSlashIfAny(editor);
  editor.commands.focus();
  editor.commands.insertTable({ rows: r, cols: c, withHeaderRow });
  editor.commands.fixTables();
}

/** 在指定位置插入表格（用于「在下方添加」） */
export function insertFeishuTableAt(editor: Editor, pos: number, rows: number, cols: number, withHeaderRow = false) {
  const { rows: r, cols: c } = clampTableSize(rows, cols);
  editor.commands.setTextSelection(pos);
  editor.commands.insertTable({ rows: r, cols: c, withHeaderRow });
  editor.commands.fixTables();
}

/** 解析表格节点在文档中的起始位置 */
export function getTablePosFromHost(editor: Editor, host: HTMLElement): number | null {
  if (!host.isConnected || !editor.view.dom.contains(host)) return null;

  const tryResolve = (node: Node, offset = 0): number | null => {
    try {
      const pos = editor.view.posAtDOM(node, offset);
      const $pos = editor.state.doc.resolve(pos);
      for (let d = $pos.depth; d > 0; d--) {
        if ($pos.node(d).type.name === 'table') return $pos.before(d);
      }
    } catch {
      return null;
    }
    return null;
  };

  const fromHost = tryResolve(host, 0);
  if (fromHost != null) return fromHost;

  const table = getTableElementFromHost(host);
  if (table) {
    const fromTable = tryResolve(table, 0);
    if (fromTable != null) return fromTable;

    const cell = table.querySelector('td, th');
    if (cell) {
      const fromCell = tryResolve(cell, 0);
      if (fromCell != null) return fromCell;
    }
  }

  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return;
    const dom = editor.view.nodeDOM(pos);
    if (!dom) return;
    const el = dom instanceof HTMLElement ? dom : null;
    if (!el) return;
    if (el === host || host.contains(el) || el.contains(host)) {
      found = pos;
      return false;
    }
  });
  return found;
}

/** 选中整张表格（块柄悬停时蓝色高亮） */
export function selectTableNodeFromHost(editor: Editor, host: HTMLElement): boolean {
  const tablePos = getTablePosFromHost(editor, host);
  if (tablePos == null) return false;
  try {
    return editor.chain().focus().setNodeSelection(tablePos).run();
  } catch {
    return false;
  }
}

/** @deprecated 使用 getTablePosFromHost */
export function getTablePosFromWrapper(editor: Editor, host: HTMLElement): number | null {
  return getTablePosFromHost(editor, host);
}

/** 计算 (row, col) 对应单元格内可编辑位置 */
export function resolveCellTextPos(tablePos: number, row: number, col: number, editor: Editor): number | null {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table' || table.childCount === 0) return null;

  const safeRow = Math.max(0, Math.min(row, table.childCount - 1));
  const rowNode = table.child(safeRow);
  const safeCol = Math.max(0, Math.min(col, rowNode.childCount - 1));

  let pos = tablePos + 1;
  for (let r = 0; r < safeRow; r++) pos += table.child(r).nodeSize;
  for (let c = 0; c < safeCol; c++) pos += rowNode.child(c).nodeSize;

  const cell = rowNode.child(safeCol);
  const inside = pos + 1;
  const docSize = editor.state.doc.content.size;
  if (inside >= docSize) return null;

  try {
    const $pos = editor.state.doc.resolve(inside);
    if ($pos.parent.type.name === 'paragraph') return inside;
    return TextSelection.near($pos, 1).from;
  } catch {
    return null;
  }
}

/** 将光标移入表格指定单元格 */
export function focusTableCell(editor: Editor, tablePos: number, row: number, col = 0): boolean {
  const textPos = resolveCellTextPos(tablePos, row, col, editor);
  if (textPos == null) return false;

  try {
    const $pos = editor.state.doc.resolve(textPos);
    const sel = TextSelection.near($pos, 1);
    editor.view.dispatch(editor.state.tr.setSelection(sel).scrollIntoView());
    editor.view.focus();
    return true;
  } catch {
    return false;
  }
}

function runTableRowCommand(editor: Editor, tablePos: number, row: number, col: number, after: boolean): boolean {
  if (!focusTableCell(editor, tablePos, row, col)) return false;
  const ok = after
    ? editor.chain().focus().addRowAfter().run()
    : editor.chain().focus().addRowBefore().run();
  if (ok) editor.commands.fixTables();
  return ok;
}

function runTableColumnCommand(editor: Editor, tablePos: number, row: number, col: number, after: boolean): boolean {
  if (!focusTableCell(editor, tablePos, row, col)) return false;
  const ok = after
    ? editor.chain().focus().addColumnAfter().run()
    : editor.chain().focus().addColumnBefore().run();
  if (ok) editor.commands.fixTables();
  return ok;
}

/** 在指定行索引前/后插入行 */
export function insertTableRowAt(editor: Editor, tablePos: number, rowIndex: number, after = false): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table) return false;
  const rowCount = table.childCount;
  const safeRow = Math.max(0, Math.min(rowIndex, rowCount - 1));
  return runTableRowCommand(editor, tablePos, safeRow, 0, after);
}

/** 在指定列索引前/后插入列 */
export function insertTableColumnAt(editor: Editor, tablePos: number, colIndex: number, after = false): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.childCount === 0) return false;
  const colCount = table.child(0).childCount;
  const safeCol = Math.max(0, Math.min(colIndex, colCount - 1));
  return runTableColumnCommand(editor, tablePos, 0, safeCol, after);
}

/**
 * 按轨道边界插入行。
 * boundaryIndex：0 = 首行上方，length-1 = 末行下方，中间 = 两行之间。
 */
export function insertTableRowAtBoundary(
  editor: Editor,
  tablePos: number,
  boundaryIndex: number,
  boundaryCount: number,
): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || boundaryCount < 2) return insertTableRowAt(editor, tablePos, 0, false);

  const rowCount = table.childCount;
  if (boundaryIndex <= 0) return insertTableRowAt(editor, tablePos, 0, false);
  if (boundaryIndex >= boundaryCount - 1) return insertTableRowAt(editor, tablePos, rowCount - 1, true);
  return insertTableRowAt(editor, tablePos, boundaryIndex, false);
}

/**
 * 按轨道边界插入列。
 * boundaryIndex：0 = 首列左侧，length-1 = 末列右侧，中间 = 两列之间。
 */
export function insertTableColumnAtBoundary(
  editor: Editor,
  tablePos: number,
  boundaryIndex: number,
  boundaryCount: number,
): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.childCount === 0) return false;

  const colCount = table.child(0).childCount;
  if (boundaryCount < 2) return insertTableColumnAt(editor, tablePos, 0, false);
  if (boundaryIndex <= 0) return insertTableColumnAt(editor, tablePos, 0, false);
  if (boundaryIndex >= boundaryCount - 1) return insertTableColumnAt(editor, tablePos, colCount - 1, true);
  return insertTableColumnAt(editor, tablePos, boundaryIndex, false);
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

/** 基于当前选区插入行/列（块菜单用） */
export function insertTableRowRelative(editor: Editor, direction: 'before' | 'after'): boolean {
  const ctx = getActiveTableContext(editor);
  if (!ctx) return false;
  return insertTableRowAt(editor, ctx.tablePos, ctx.rowIndex, direction === 'after');
}

export function insertTableColumnRelative(editor: Editor, direction: 'before' | 'after'): boolean {
  const ctx = getActiveTableContext(editor);
  if (!ctx) return false;
  return insertTableColumnAt(editor, ctx.tablePos, ctx.colIndex, direction === 'after');
}
