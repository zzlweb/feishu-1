import type { Editor } from '@tiptap/react';
import { Fragment, type Node as ProseNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { getSlashRange } from './slashMenuConfig';
import { getTablePosFromHost } from './tableDom';

export const TABLE_GRID_MAX = 10;

export function deleteSlashIfAny(editor: Editor) {
  const plusRange = (editor as any).__plusInsertRange as { from: number; to: number } | null | undefined;
  if (plusRange && plusRange.from < plusRange.to) {
    editor.chain().focus().deleteRange(plusRange).run();
    (editor as any).__plusInsertRange = null;
    return;
  }
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

function createTableNode(editor: Editor, rows: number, cols: number, withHeaderRow: boolean): ProseNode | null {
  const tableType = editor.schema.nodes.table;
  const rowType = editor.schema.nodes.tableRow;
  const cellType = editor.schema.nodes.tableCell;
  const headerType = editor.schema.nodes.tableHeader;
  const paragraphType = editor.schema.nodes.paragraph;
  if (!tableType || !rowType || !cellType || !paragraphType) return null;

  const rowNodes = Array.from({ length: rows }, (_, rowIndex) => {
    const currentCellType = withHeaderRow && rowIndex === 0 && headerType ? headerType : cellType;
    const cells = Array.from({ length: cols }, () => currentCellType.create(null, paragraphType.create()));
    return rowType.create(null, cells);
  });

  return tableType.create(null, rowNodes);
}

function isValidPlusInsertRange(editor: Editor, plusRange: { from: number; to: number }) {
  if (plusRange.from < 0 || plusRange.to <= plusRange.from) return false;
  if (plusRange.to > editor.state.doc.content.size) return false;
  const node = editor.state.doc.nodeAt(plusRange.from);
  return Boolean(node?.isBlock && plusRange.to === plusRange.from + node.nodeSize);
}

/** 插入支持富文本的表格（默认无标题行；可通过块菜单切换） */
export function insertFeishuTable(editor: Editor, rows: number, cols: number, withHeaderRow = false) {
  const { rows: r, cols: c } = clampTableSize(rows, cols);
  const plusRange = (editor as any).__plusInsertRange as { from: number; to: number } | null | undefined;
  if (plusRange && isValidPlusInsertRange(editor, plusRange)) {
    const insertPos = plusRange.from;
    (editor as any).__plusInsertRange = null;
    const tableNode = createTableNode(editor, r, c, withHeaderRow);
    if (!tableNode) return;
    const tr = editor.state.tr.replaceWith(insertPos, plusRange.to, tableNode).scrollIntoView();
    editor.view.dispatch(tr);
    editor.view.focus();
    editor.commands.fixTables();
    focusTableCell(editor, insertPos, 0, 0);
    return;
  }
  (editor as any).__plusInsertRange = null;
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
  pos += 1;
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

export interface ActiveTableSelectionContext {
  tablePos: number;
  rowIndex: number;
  colIndex: number;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  rowCount: number;
  colCount: number;
  isRowSelection: boolean;
  isColSelection: boolean;
}

export function getActiveTableSelectionContext(editor: Editor): ActiveTableSelectionContext | null {
  const { state } = editor;
  const { selection } = state;

  if (selection instanceof CellSelection) {
    const tableStart = selection.$anchorCell.start(-1);
    const tablePos = tableStart - 1;
    const table = state.doc.nodeAt(tablePos);
    if (!table || table.type.name !== 'table') return null;

    const map = TableMap.get(table);
    const anchorRect = map.findCell(selection.$anchorCell.pos - tableStart);
    const headRect = map.findCell(selection.$headCell.pos - tableStart);
    const rowStart = Math.min(anchorRect.top, headRect.top);
    const rowEnd = Math.max(anchorRect.bottom, headRect.bottom);
    const colStart = Math.min(anchorRect.left, headRect.left);
    const colEnd = Math.max(anchorRect.right, headRect.right);

    return {
      tablePos,
      rowIndex: rowStart,
      colIndex: colStart,
      rowStart,
      rowEnd,
      colStart,
      colEnd,
      rowCount: table.childCount,
      colCount: map.width,
      isRowSelection: selection.isRowSelection(),
      isColSelection: selection.isColSelection(),
    };
  }

  const ctx = getActiveTableContext(editor);
  if (!ctx) return null;
  const table = state.doc.nodeAt(ctx.tablePos);
  if (!table || table.type.name !== 'table') return null;
  const map = TableMap.get(table);
  return {
    ...ctx,
    rowStart: ctx.rowIndex,
    rowEnd: ctx.rowIndex + 1,
    colStart: ctx.colIndex,
    colEnd: ctx.colIndex + 1,
    rowCount: table.childCount,
    colCount: map.width,
    isRowSelection: false,
    isColSelection: false,
  };
}

/** 基于当前选区插入行/列（块菜单用） */
export function insertTableRowRelative(editor: Editor, direction: 'before' | 'after'): boolean {
  const ctx = getActiveTableSelectionContext(editor);
  if (!ctx) return false;
  const rowIndex = direction === 'after' ? ctx.rowEnd - 1 : ctx.rowStart;
  return insertTableRowAt(editor, ctx.tablePos, rowIndex, direction === 'after');
}

export function insertTableColumnRelative(editor: Editor, direction: 'before' | 'after'): boolean {
  const ctx = getActiveTableSelectionContext(editor);
  if (!ctx) return false;
  const colIndex = direction === 'after' ? ctx.colEnd - 1 : ctx.colStart;
  return insertTableColumnAt(editor, ctx.tablePos, colIndex, direction === 'after');
}

export function deleteActiveTableRow(editor: Editor): boolean {
  const ctx = getActiveTableSelectionContext(editor);
  if (!ctx) return false;
  if (!focusTableCell(editor, ctx.tablePos, ctx.rowStart, ctx.colStart)) return false;
  return editor.chain().focus().deleteRow().run();
}

export function deleteActiveTableColumn(editor: Editor): boolean {
  const ctx = getActiveTableSelectionContext(editor);
  if (!ctx) return false;
  if (!focusTableCell(editor, ctx.tablePos, ctx.rowStart, ctx.colStart)) return false;
  return editor.chain().focus().deleteColumn().run();
}

export function distributeActiveTableColumns(editor: Editor): boolean {
  const ctx = getActiveTableSelectionContext(editor);
  if (!ctx) return false;
  const table = editor.state.doc.nodeAt(ctx.tablePos);
  if (!table || table.type.name !== 'table') return false;

  const tableEl = editor.view.domAtPos(ctx.tablePos + 1).node instanceof Element
    ? (editor.view.domAtPos(ctx.tablePos + 1).node as Element).closest('table')
    : null;
  const availableWidth = tableEl instanceof HTMLTableElement && tableEl.getBoundingClientRect().width > 0
    ? tableEl.getBoundingClientRect().width
    : Math.max(ctx.colCount * 100, 100);
  const nextWidth = Math.max(64, Math.floor(availableWidth / ctx.colCount));

  let tr = editor.state.tr;
  let rowPos = ctx.tablePos + 1;
  for (let rowIndex = 0; rowIndex < table.childCount; rowIndex += 1) {
    const row = table.child(rowIndex);
    let cellPos = rowPos + 1;
    for (let cellIndex = 0; cellIndex < row.childCount; cellIndex += 1) {
      const cell = row.child(cellIndex);
      const colspan = Number(cell.attrs.colspan || 1);
      tr = tr.setNodeMarkup(cellPos, undefined, {
        ...cell.attrs,
        colwidth: Array.from({ length: colspan }, () => nextWidth),
      });
      cellPos += cell.nodeSize;
    }
    rowPos += row.nodeSize;
  }

  editor.view.dispatch(tr);
  editor.commands.fixTables();
  return true;
}

export function setTableColumnWidth(
  editor: Editor,
  tablePos: number,
  colIndex: number,
  width: number,
): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return false;
  const map = TableMap.get(table);
  if (colIndex < 0 || colIndex >= map.width) return false;

  const nextWidth = Math.max(1, Math.round(width));
  let tr = editor.state.tr;
  const tableStart = tablePos + 1;

  for (let rowIndex = 0; rowIndex < map.height; rowIndex += 1) {
    const mapIndex = rowIndex * map.width + colIndex;
    if (rowIndex > 0 && map.map[mapIndex] === map.map[mapIndex - map.width]) continue;

    const cellOffset = map.map[mapIndex];
    const cell = table.nodeAt(cellOffset);
    if (!cell) continue;

    const cellRect = map.findCell(cellOffset);
    if (colIndex < cellRect.left || colIndex >= cellRect.right) continue;

    const widthIndex = colIndex - cellRect.left;
    const colspan = Number(cell.attrs.colspan || 1);
    const colwidth = Array.isArray(cell.attrs.colwidth)
      ? cell.attrs.colwidth.slice()
      : Array.from({ length: colspan }, () => 0);
    while (colwidth.length < colspan) colwidth.push(0);
    colwidth[widthIndex] = nextWidth;

    tr = tr.setNodeMarkup(tableStart + cellOffset, undefined, {
      ...cell.attrs,
      colwidth,
    });
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  editor.commands.fixTables();
  return true;
}

export function setTableRowHeight(
  editor: Editor,
  tablePos: number,
  rowIndex: number,
  height: number,
): boolean {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return false;
  if (rowIndex < 0 || rowIndex >= table.childCount) return false;

  let rowPos = tablePos + 1;
  for (let index = 0; index < rowIndex; index += 1) {
    rowPos += table.child(index).nodeSize;
  }

  const row = table.child(rowIndex);
  const nextHeight = Math.max(1, Math.round(height));
  const tr = editor.state.tr.setNodeMarkup(rowPos, undefined, {
    ...row.attrs,
    rowHeight: nextHeight,
  });

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr.scrollIntoView());
  editor.commands.fixTables();
  return true;
}

function getSimpleTableDimensions(table: ProseNode): { rows: number; cols: number } | null {
  if (!table || table.type.name !== 'table' || table.childCount === 0) return null;
  const cols = table.child(0).childCount;
  if (cols === 0) return null;

  for (let rowIndex = 0; rowIndex < table.childCount; rowIndex += 1) {
    const row = table.child(rowIndex);
    if (row.childCount !== cols) return null;
    for (let colIndex = 0; colIndex < row.childCount; colIndex += 1) {
      const cell = row.child(colIndex);
      if (Number(cell.attrs.rowspan || 1) !== 1 || Number(cell.attrs.colspan || 1) !== 1) {
        return null;
      }
    }
  }

  return { rows: table.childCount, cols };
}

function moveArrayItem<T>(items: T[], fromIndex: number, targetIndex: number): { items: T[]; movedIndex: number } | null {
  if (fromIndex < 0 || fromIndex >= items.length) return null;
  const safeTarget = Math.max(0, Math.min(targetIndex, items.length));
  if (safeTarget === fromIndex || safeTarget === fromIndex + 1) return null;

  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  const insertIndex = safeTarget > fromIndex ? safeTarget - 1 : safeTarget;
  next.splice(insertIndex, 0, item);
  return { items: next, movedIndex: insertIndex };
}

export function moveTableRow(editor: Editor, tablePos: number, fromRow: number, targetRowBoundary: number): number | null {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return null;
  const dims = getSimpleTableDimensions(table);
  if (!dims) return null;

  const moved = moveArrayItem(
    Array.from({ length: dims.rows }, (_, index) => table.child(index)),
    fromRow,
    targetRowBoundary,
  );
  if (!moved) return null;

  const nextTable = table.copy(Fragment.fromArray(moved.items));
  const tr = editor.state.tr.replaceWith(tablePos, tablePos + table.nodeSize, nextTable).scrollIntoView();
  editor.view.dispatch(tr);
  editor.commands.fixTables();
  return moved.movedIndex;
}

export function moveTableColumn(editor: Editor, tablePos: number, fromCol: number, targetColBoundary: number): number | null {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return null;
  const dims = getSimpleTableDimensions(table);
  if (!dims) return null;

  if (fromCol < 0 || fromCol >= dims.cols) return null;
  const safeTarget = Math.max(0, Math.min(targetColBoundary, dims.cols));
  if (safeTarget === fromCol || safeTarget === fromCol + 1) return null;
  const movedIndex = safeTarget > fromCol ? safeTarget - 1 : safeTarget;

  const rows = Array.from({ length: dims.rows }, (_, rowIndex) => {
    const row = table.child(rowIndex);
    const moved = moveArrayItem(
      Array.from({ length: dims.cols }, (_, colIndex) => row.child(colIndex)),
      fromCol,
      safeTarget,
    );
    return row.copy(Fragment.fromArray(moved?.items ?? []));
  });

  const nextTable = table.copy(Fragment.fromArray(rows));
  const tr = editor.state.tr.replaceWith(tablePos, tablePos + table.nodeSize, nextTable).scrollIntoView();
  editor.view.dispatch(tr);
  editor.commands.fixTables();
  return movedIndex;
}

function normalizeCellText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
}

interface ParsedTableCell {
  text: string;
  html?: Element;
  isHeader?: boolean;
  backgroundColor?: string;
}

type ParsedTableMatrix = ParsedTableCell[][];

function emptyParsedCell(): ParsedTableCell {
  return { text: '' };
}

function readCellBackground(cell: Element): string {
  if (cell instanceof HTMLElement) {
    return cell.style.backgroundColor || cell.getAttribute('bgcolor') || '';
  }
  return cell.getAttribute('bgcolor') || '';
}

function parseHtmlTable(html: string): ParsedTableMatrix | null {
  if (!html || !/<table[\s>]/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const matrix: ParsedTableMatrix = [];
  const rowSpans: number[] = [];
  table.querySelectorAll('tr').forEach((tr, rowIndex) => {
    const row: ParsedTableCell[] = [];
    let colIndex = 0;
    const flushRowSpanPlaceholders = () => {
      while ((rowSpans[colIndex] || 0) > 0) {
        row.push(emptyParsedCell());
        rowSpans[colIndex] -= 1;
        colIndex += 1;
      }
    };

    flushRowSpanPlaceholders();
    tr.querySelectorAll('th,td').forEach(cell => {
      const colspan = Math.max(1, Number(cell.getAttribute('colspan') || 1));
      const rowspan = Math.max(1, Number(cell.getAttribute('rowspan') || 1));
      const text = normalizeCellText(cell.textContent || '');
      row.push({
        text,
        html: cell,
        isHeader: cell.tagName.toLowerCase() === 'th' || rowIndex === 0 && tr.querySelectorAll('th').length > 0,
        backgroundColor: readCellBackground(cell),
      });
      if (rowspan > 1) rowSpans[colIndex] = Math.max(rowSpans[colIndex] || 0, rowspan - 1);
      colIndex += 1;
      for (let i = 1; i < colspan; i += 1) {
        row.push(emptyParsedCell());
        if (rowspan > 1) rowSpans[colIndex] = Math.max(rowSpans[colIndex] || 0, rowspan - 1);
        colIndex += 1;
      }
      flushRowSpanPlaceholders();
    });
    if (row.length > 0) matrix.push(row);
  });

  return matrix.length > 0 ? matrix : null;
}

function parseDelimitedTable(text: string): ParsedTableMatrix | null {
  const normalized = text.replace(/\r\n?/g, '\n').trimEnd();
  if (!normalized.includes('\t') && !normalized.includes('\n')) return null;
  const rows = normalized
    .split('\n')
    .map(row => row.split('\t').map(cell => ({ text: normalizeCellText(cell) })));
  const nonEmpty = rows.filter(row => row.some(cell => cell.text.length > 0));
  if (nonEmpty.length < 2 && Math.max(...nonEmpty.map(row => row.length), 0) < 2) return null;
  return nonEmpty.length > 0 ? nonEmpty : null;
}

function normalizeInlineText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
}

function textNodesWithBreaks(editor: Editor, value: string, marks: any[] = []): ProseNode[] {
  const hardBreak = editor.schema.nodes.hardBreak;
  const nodes: ProseNode[] = [];
  const parts = value.replace(/\r\n?/g, '\n').split('\n');
  parts.forEach((part, index) => {
    const text = normalizeInlineText(part);
    if (text) nodes.push(editor.schema.text(text, marks));
    if (index < parts.length - 1 && hardBreak) nodes.push(hardBreak.create());
  });
  return nodes;
}

function collectCellInlineNodes(editor: Editor, root: Element | undefined): ProseNode[] {
  if (!root) return [];
  const linkMark = editor.schema.marks.link;
  const nodes: ProseNode[] = [];
  const visit = (node: Node, marks: any[] = []) => {
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push(...textNodesWithBreaks(editor, node.textContent || '', marks));
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.tagName.toLowerCase() === 'br') {
      const hardBreak = editor.schema.nodes.hardBreak;
      if (hardBreak) nodes.push(hardBreak.create());
      return;
    }
    const nextMarks = [...marks];
    if (node.tagName.toLowerCase() === 'a' && linkMark) {
      const href = node.getAttribute('href');
      if (href) nextMarks.push(linkMark.create({ href }));
    }
    const before = nodes.length;
    node.childNodes.forEach(child => visit(child, nextMarks));
    if (['p', 'div'].includes(node.tagName.toLowerCase()) && nodes.length > before) {
      const hardBreak = editor.schema.nodes.hardBreak;
      if (hardBreak) nodes.push(hardBreak.create());
    }
  };
  root.childNodes.forEach(child => visit(child));
  while (nodes[nodes.length - 1]?.type.name === 'hardBreak') nodes.pop();
  return nodes;
}

function createTableNodeFromMatrix(editor: Editor, matrix: ParsedTableMatrix): ProseNode | null {
  const tableType = editor.schema.nodes.table;
  const rowType = editor.schema.nodes.tableRow;
  const cellType = editor.schema.nodes.tableCell;
  const headerType = editor.schema.nodes.tableHeader;
  const paragraphType = editor.schema.nodes.paragraph;
  if (!tableType || !rowType || !cellType || !paragraphType) return null;

  const cols = Math.max(...matrix.map(row => row.length));
  if (matrix.length === 0 || cols === 0) return null;

  const rows = matrix.map(row => rowType.create(null, Array.from({ length: cols }, (_, colIndex) => {
    const cell = row[colIndex] ?? emptyParsedCell();
    const inlineContent = collectCellInlineNodes(editor, cell.html);
    const paragraph = inlineContent.length > 0
      ? paragraphType.create(null, inlineContent)
      : cell.text
        ? paragraphType.create(null, textNodesWithBreaks(editor, cell.text))
        : paragraphType.create();
    const type = cell.isHeader && headerType ? headerType : cellType;
    const attrs = cell.backgroundColor ? { backgroundColor: cell.backgroundColor } : null;
    return type.create(attrs, paragraph);
  })));

  return tableType.create(null, rows);
}
export function insertTableFromClipboardData(editor: Editor, clipboardData: DataTransfer | null): boolean {
  if (!clipboardData) return false;
  if (editor.isActive('table')) return false;

  const matrix =
    parseHtmlTable(clipboardData.getData('text/html'))
    ?? parseDelimitedTable(clipboardData.getData('text/plain'));
  if (!matrix) return false;

  const tableNode = createTableNodeFromMatrix(editor, matrix);
  if (!tableNode) return false;

  editor.chain().focus().insertContent(tableNode.toJSON()).run();
  editor.commands.fixTables();
  return true;
}
