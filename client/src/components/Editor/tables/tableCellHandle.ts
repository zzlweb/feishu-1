import type { Editor } from '@tiptap/react';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { NodeSelection } from '@tiptap/pm/state';
import { getTableChromeMountFromHost, getTablePosFromHost } from './tableDom';

export interface TableCellHandleState {
  left: number;
  top: number;
  row: number;
  col: number;
  mode: 'insert' | 'block';
  blockType: string;
  cursorPos: number;
}

/** 块柄显示在当前块内容起始位置（字的前面），而非光标位置 */
const HANDLE_OFFSET_LEFT = 36;

function mapNodeTypeToBlockType(node: { type: { name: string }; attrs: Record<string, unknown> }): string {
  const name = node.type.name;
  if (name === 'image') return 'image';
  if (name === 'horizontalRule') return 'hr';
  if (name === 'localFileBlock') {
    const kind = String(node.attrs.mediaKind || 'file');
    return kind === 'image' ? 'image' : 'file';
  }
  if (name === 'localEmbedBlock') {
    return String(node.attrs.kind || 'embed') === 'subdoc' ? 'subdoc' : 'embed';
  }
  return name;
}

function resolveBlockTypeFromEditor(editor: Editor): string {
  for (let i = 1; i <= 6; i++) {
    if (editor.isActive('heading', { level: i })) return `h${i}`;
  }
  if (editor.isActive('taskList')) return 'task';
  if (editor.isActive('orderedList')) return 'orderedList';
  if (editor.isActive('bulletList')) return 'bulletList';
  if (editor.isActive('blockquote')) return 'blockquote';
  if (editor.isActive('codeBlock')) return 'codeBlock';
  if (editor.isActive('highlightBlock')) return 'highlightBlock';
  if (editor.isActive('horizontalRule')) return 'hr';
  if (editor.isActive('image')) return 'image';
  if (editor.isActive('localFileBlock')) return 'file';
  if (editor.isActive('localEmbedBlock')) return 'embed';
  return 'paragraph';
}

function isEmptyParagraphAtPos(editor: Editor): boolean {
  if (!editor.isActive('paragraph')) return false;
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'paragraph') {
      return $from.node(d).textContent.trim().length === 0;
    }
  }
  return false;
}

function resolveCellIndices(
  editor: Editor,
  tableHost: HTMLElement,
  cellEl: HTMLElement,
): { row: number; col: number } | null {
  const rowAttr = cellEl.getAttribute('data-row-index');
  const colAttr = cellEl.getAttribute('data-col-index');
  if (rowAttr != null && colAttr != null) {
    return { row: Number(rowAttr), col: Number(colAttr) };
  }

  const tablePos = getTablePosFromHost(editor, tableHost);
  if (tablePos == null) return null;
  const tableNode = editor.state.doc.nodeAt(tablePos);
  if (!tableNode) return null;

  try {
    const cellPos = editor.view.posAtDOM(cellEl, 0);
    const $cell = editor.state.doc.resolve(cellPos);
    for (let d = $cell.depth; d > 0; d--) {
      if ($cell.node(d).type.name !== 'tableCell' && $cell.node(d).type.name !== 'tableHeader') continue;
      const beforeCell = $cell.before(d);
      const map = TableMap.get(tableNode);
      const rect = map.findCell(beforeCell - (tablePos + 1) + 1);
      return { row: rect.top, col: rect.left };
    }
  } catch {
    return null;
  }
  return null;
}

function resolveCellElementInHost(editor: Editor, tableHost: HTMLElement): HTMLElement | null {
  const { selection } = editor.state;
  const $probe = selection instanceof NodeSelection ? selection.$anchor : selection.$from;

  for (let d = $probe.depth; d > 0; d--) {
    const name = $probe.node(d).type.name;
    if (name !== 'tableCell' && name !== 'tableHeader') continue;
    try {
      const cellPos = $probe.before(d);
      let dom = editor.view.nodeDOM(cellPos);
      if (!(dom instanceof HTMLElement)) {
        dom = editor.view.nodeDOM(cellPos + 1);
      }
      const cellEl = dom instanceof HTMLElement
        ? (dom.closest('td, th') as HTMLElement | null)
        : null;
      if (cellEl?.isConnected && tableHost.contains(cellEl)) return cellEl;
    } catch {
      return null;
    }
  }
  return null;
}

function resolveBlockStartPos(editor: Editor): number {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection) return selection.from;

  const { $from } = selection;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === 'tableCell' || name === 'tableHeader') break;
    const node = $from.node(d);
    if (node.isBlock && name !== 'table' && name !== 'tableRow') {
      return $from.start(d);
    }
  }
  return $from.start();
}

function resolveHandleCoords(
  editor: Editor,
  selection: Editor['state']['selection'],
  blockStartPos: number,
): { left: number; top: number } | null {
  const docSize = editor.state.doc.content.size;

  if (selection instanceof NodeSelection) {
    try {
      const nodeEl = editor.view.nodeDOM(selection.from);
      if (nodeEl instanceof HTMLElement) {
        const rect = nodeEl.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top + rect.height / 2,
        };
      }
    } catch { /* fall through */ }
  }

  const coordsPos = Math.min(Math.max(1, blockStartPos), docSize - 1);
  try {
    const coords = editor.view.coordsAtPos(coordsPos);
    return {
      left: coords.left,
      top: coords.top + (coords.bottom - coords.top) / 2,
    };
  } catch {
    return null;
  }
}

/** 光标位于指定表格单元格内时，解析应显示的块柄（+ 或块类型图标）及屏幕坐标 */
export function resolveTableCellHandle(
  editor: Editor,
  tableHost: HTMLElement,
): TableCellHandleState | null {
  if (!tableHost.isConnected || !editor.view?.dom?.contains(tableHost)) return null;
  if (!editor.isEditable) return null;

  const { selection } = editor.state;
  if (selection instanceof CellSelection) return null;

  const cellEl = resolveCellElementInHost(editor, tableHost);
  if (!cellEl) return null;

  const indices = resolveCellIndices(editor, tableHost, cellEl);
  if (!indices) return null;

  const cursorPos = selection.from;
  let blockType = 'paragraph';
  let mode: 'insert' | 'block' = 'block';

  if (selection instanceof NodeSelection) {
    blockType = mapNodeTypeToBlockType(selection.node);
    mode = 'block';
  } else {
    blockType = resolveBlockTypeFromEditor(editor);
    mode = isEmptyParagraphAtPos(editor) ? 'insert' : 'block';
  }

  const blockStartPos = resolveBlockStartPos(editor);
  const handleCoords = resolveHandleCoords(editor, selection, blockStartPos);
  if (!handleCoords) return null;

  const mountRect = getTableChromeMountFromHost(tableHost).getBoundingClientRect();
  const left = handleCoords.left - mountRect.left - HANDLE_OFFSET_LEFT;
  const top = handleCoords.top - mountRect.top;

  return {
    left,
    top,
    row: indices.row,
    col: indices.col,
    mode,
    blockType,
    cursorPos,
  };
}
