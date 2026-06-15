import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Extension } from '@tiptap/core';
import { Fragment, DOMSerializer, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, NodeSelection, Selection, TextSelection } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { FeishuTableView } from './feishuTableView';
import { sanitizeFeishuBlockId } from '../blocks/feishuBlockId';

const TABLE_CLASS = 'feishu-table';
const TABLE_MIME = 'application/x-feishu-doc-table';

function createStableId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function closestElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Text) return target.parentElement;
  return null;
}

function isTableUiTarget(target: EventTarget | null): boolean {
  const element = closestElement(target);
  return Boolean(element?.closest(
    '[data-no-marquee-selection="true"], [data-floating-panel="true"], [data-table-resize-handle="true"], [data-table-axis-handle="true"], .feishu-table-chrome, .feishu-table-chrome-mount, .selection-bubble, .context-menu, .context-submenu-flyout, .context-add-below-flyout',
  ));
}

function textNodeClientRectsContainPoint(root: Element, clientX: number, clientY: number): boolean {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects());
      range.detach();
      if (rects.some(rect => (
        clientX >= rect.left - 2
        && clientX <= rect.right + 2
        && clientY >= rect.top - 2
        && clientY <= rect.bottom + 2
      ))) {
        return true;
      }
    }
    node = walker.nextNode();
  }
  return false;
}

function resolveCellElement(target: EventTarget | null): HTMLElement | null {
  const element = closestElement(target);
  const cell = element?.closest('td, th');
  return cell instanceof HTMLElement ? cell : null;
}

function resolveCellSelectionPos(view: any, cell: HTMLElement): number | null {
  try {
    const pos = view.posAtDOM(cell, 0);
    const $pos = view.state.doc.resolve(pos);
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth);
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        return $pos.before(depth);
      }
    }
    const after = view.state.doc.resolve(Math.min(pos + 1, view.state.doc.content.size));
    for (let depth = after.depth; depth > 0; depth -= 1) {
      const node = after.node(depth);
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        return after.before(depth);
      }
    }
  } catch {
    return null;
  }
  return null;
}

function findEditableCellTextPos(view: any, cell: HTMLElement, preferEnd: boolean): number | null {
  const cellPos = resolveCellSelectionPos(view, cell);
  if (cellPos == null) return null;
  const cellNode = view.state.doc.nodeAt(cellPos);
  if (!cellNode) return null;
  const raw = preferEnd ? cellPos + Math.max(1, cellNode.nodeSize - 2) : cellPos + 1;
  const pos = Math.max(0, Math.min(raw, view.state.doc.content.size));
  try {
    return TextSelection.near(view.state.doc.resolve(pos), preferEnd ? -1 : 1).from;
  } catch {
    return null;
  }
}

function beginCellRangeDrag(view: any, event: MouseEvent, anchorCell: HTMLElement): boolean {
  const anchorPos = resolveCellSelectionPos(view, anchorCell);
  if (anchorPos == null) return false;

  const startX = event.clientX;
  const startY = event.clientY;
  const pointerId = event instanceof PointerEvent ? event.pointerId : null;
  let dragging = false;

  const setCellSelection = (targetCell: HTMLElement) => {
    const headPos = resolveCellSelectionPos(view, targetCell);
    if (headPos == null) return;
    try {
      const $anchor = view.state.doc.resolve(anchorPos);
      const $head = view.state.doc.resolve(headPos);
      view.dispatch(view.state.tr.setSelection(new CellSelection($anchor, $head)).scrollIntoView());
    } catch {
      // Ignore transient positions while the editor is mutating.
    }
  };

  const onMove = (moveEvent: MouseEvent) => {
    const dx = Math.abs(moveEvent.clientX - startX);
    const dy = Math.abs(moveEvent.clientY - startY);
    if (!dragging && dx < 4 && dy < 4) return;
    dragging = true;
    moveEvent.preventDefault();
    window.getSelection()?.removeAllRanges();
    const hit = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
    const targetCell = hit?.closest('td, th');
    if (targetCell instanceof HTMLElement) setCellSelection(targetCell);
  };

  const finish = (upEvent: MouseEvent) => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', finish, true);
    if (pointerId != null) {
      try {
        anchorCell.releasePointerCapture?.(pointerId);
      } catch {
        // Pointer capture may already have been released.
      }
    }
    if (dragging) {
      upEvent.preventDefault();
      return;
    }
    const textPos = findEditableCellTextPos(view, anchorCell, true);
    if (textPos != null) {
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(textPos), -1)));
      view.focus();
    }
  };

  event.preventDefault();
  event.stopPropagation();
  window.getSelection()?.removeAllRanges();
  if (pointerId != null) {
    try {
      anchorCell.setPointerCapture?.(pointerId);
    } catch {
      // Some browsers do not allow capture on table cells.
    }
  }
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', finish, true);
  return true;
}

function isSelectionInsideTable(selection: Selection): boolean {
  const $probe = selection instanceof CellSelection ? selection.$anchorCell : selection.$from;
  for (let depth = $probe.depth; depth > 0; depth -= 1) {
    if ($probe.node(depth).type.name === 'table') return true;
  }
  return false;
}

function findTableDepth($pos: TextSelection['$from']): number | null {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === 'table') return depth;
  }
  return null;
}

function cellText(node: ProseMirrorNode) {
  return node.textBetween(0, node.content.size, '\n', '\n').trim();
}

function cellHtml(node: ProseMirrorNode, schema: ProseMirrorNode['type']['schema']) {
  const wrap = document.createElement('div');
  DOMSerializer.fromSchema(schema).serializeFragment(node.content, { document }, wrap);
  return wrap.innerHTML || '<p></p>';
}

interface ClipboardMatrixCell {
  text: string;
  json?: unknown;
}

type ClipboardMatrix = ClipboardMatrixCell[][];

function matrixFromClipboard(html: string, text: string): ClipboardMatrix | null {
  if (html && /<table[\s>]/i.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (table) {
      const rows: ClipboardMatrix = [];
      table.querySelectorAll('tr').forEach(tr => {
        const row: ClipboardMatrixCell[] = [];
        tr.querySelectorAll('th,td').forEach(cell => {
          const colspan = Math.max(1, Number(cell.getAttribute('colspan') || 1));
          const value = (cell.textContent || '').replace(/\r\n?/g, '\n').trim();
          for (let i = 0; i < colspan; i += 1) row.push({ text: i === 0 ? value : '' });
        });
        if (row.length) rows.push(row);
      });
      if (rows.length) return rows;
    }
  }

  const normalized = text.replace(/\r\n?/g, '\n').trimEnd();
  if (!normalized || (!normalized.includes('\t') && !normalized.includes('\n'))) return null;
  return normalized.split('\n').map(row => row.split('\t').map(value => ({ text: value })));
}

function matrixFromCustomClipboard(raw: string): ClipboardMatrix | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { type?: string; rows?: Array<Array<{ text?: string; json?: unknown }>> };
    if (parsed.type !== 'table-cell-range' || !Array.isArray(parsed.rows)) return null;
    const rows = parsed.rows.map(row =>
      Array.isArray(row) ? row.map(cell => ({ text: cell?.text ?? '', json: cell?.json })) : [],
    );
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

function paragraphFragmentFromText(editor: any, value: string) {
  const paragraph = editor.schema.nodes.paragraph;
  if (!paragraph) return Fragment.empty;
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  return Fragment.fromArray(lines.map(line =>
    paragraph.create(null, line ? editor.schema.text(line) : undefined),
  ));
}

function writeCellMatrix(editor: any, matrix: ClipboardMatrix): boolean {
  const { selection, doc } = editor.state;
  const tableDepth = selection instanceof CellSelection
    ? selection.$anchorCell.depth - 1
    : findTableDepth(selection.$from);
  if (tableDepth == null) return false;

  const tablePos = selection instanceof CellSelection
    ? selection.$anchorCell.before(tableDepth)
    : selection.$from.before(tableDepth);
  const table = doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return false;

  const map = TableMap.get(table);
  const tableStart = tablePos + 1;
  let startRow = 0;
  let startCol = 0;
  if (selection instanceof CellSelection) {
    const rect = map.findCell(selection.$anchorCell.pos - tableStart);
    startRow = rect.top;
    startCol = rect.left;
  } else {
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      const node = selection.$from.node(depth);
      if (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader') continue;
      const rect = map.findCell(selection.$from.before(depth) - tableStart);
      startRow = rect.top;
      startCol = rect.left;
      break;
    }
  }

  let tr = editor.state.tr;
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix[r].length; c += 1) {
      const row = startRow + r;
      const col = startCol + c;
      if (row >= map.height || col >= map.width) continue;
      const cellOffset = map.map[row * map.width + col];
      const rect = map.findCell(cellOffset);
      if (rect.top !== row || rect.left !== col) continue;
      const cellPos = tableStart + cellOffset;
      const cell = table.nodeAt(cellOffset);
      if (!cell) continue;
      const source = matrix[r][c] ?? { text: '' };
      let content = paragraphFragmentFromText(editor, source.text);
      if (source.json) {
        try {
          const copiedCell = editor.schema.nodeFromJSON(source.json);
          if (copiedCell.type.name === 'tableCell' || copiedCell.type.name === 'tableHeader') content = copiedCell.content;
        } catch {
          // Invalid structured clipboard data falls back to its plain text form.
        }
      }
      const nextCell = cell.type.createChecked(cell.attrs, content, cell.marks);
      tr = tr.replaceWith(cellPos, cellPos + cell.nodeSize, nextCell);
    }
  }

  if (!tr.docChanged) return false;
  editor.view.dispatch(tr.scrollIntoView());
  editor.commands.fixTables();
  return true;
}

function copyCellSelection(editor: any, event: ClipboardEvent): boolean {
  const { selection, doc, schema } = editor.state;
  if (!(selection instanceof CellSelection) || !event.clipboardData) return false;
  const tableStart = selection.$anchorCell.start(-1);
  const tablePos = tableStart - 1;
  const table = doc.nodeAt(tablePos);
  if (!table) return false;

  const map = TableMap.get(table);
  const anchorRect = map.findCell(selection.$anchorCell.pos - tableStart);
  const headRect = map.findCell(selection.$headCell.pos - tableStart);
  const rect = {
    top: Math.min(anchorRect.top, headRect.top),
    bottom: Math.max(anchorRect.bottom, headRect.bottom),
    left: Math.min(anchorRect.left, headRect.left),
    right: Math.max(anchorRect.right, headRect.right),
  };

  const plainRows: string[][] = [];
  const htmlRows: string[] = [];
  const jsonRows: unknown[] = [];
  const seen = new Set<number>();
  for (let row = rect.top; row < rect.bottom; row += 1) {
    const plainRow: string[] = [];
    const htmlCells: string[] = [];
    const jsonCells: unknown[] = [];
    for (let col = rect.left; col < rect.right; col += 1) {
      const offset = map.map[row * map.width + col];
      const cell = table.nodeAt(offset);
      if (!cell) {
        plainRow.push('');
        continue;
      }
      const cellRect = map.findCell(offset);
      if (seen.has(offset) || cellRect.top !== row || cellRect.left !== col) {
        plainRow.push('');
        continue;
      }
      seen.add(offset);
      const rowspan = Math.min(cellRect.bottom, rect.bottom) - row;
      const colspan = Math.min(cellRect.right, rect.right) - col;
      const text = cellText(cell);
      plainRow.push(text);
      htmlCells.push(
        `<td${rowspan > 1 ? ` rowspan="${rowspan}"` : ''}${colspan > 1 ? ` colspan="${colspan}"` : ''}>${cellHtml(cell, schema)}</td>`,
      );
      jsonCells.push({
        rowspan,
        colspan,
        attrs: cell.attrs,
        json: cell.toJSON(),
        text,
      });
      for (let extra = 1; extra < colspan; extra += 1) plainRow.push('');
    }
    plainRows.push(plainRow);
    htmlRows.push(`<tr>${htmlCells.join('')}</tr>`);
    jsonRows.push(jsonCells);
  }

  event.preventDefault();
  event.clipboardData.setData('text/plain', plainRows.map(row => row.join('\t')).join('\n'));
  event.clipboardData.setData('text/html', `<table><tbody>${htmlRows.join('')}</tbody></table>`);
  event.clipboardData.setData(TABLE_MIME, JSON.stringify({ type: 'table-cell-range', rows: jsonRows }));
  return true;
}

function clearSelectedCells(editor: any): boolean {
  const { selection, doc } = editor.state;
  if (!(selection instanceof CellSelection)) return false;
  const tableStart = selection.$anchorCell.start(-1);
  const table = doc.nodeAt(tableStart - 1);
  if (!table) return false;
  const map = TableMap.get(table);
  const seen = new Set<number>();
  let tr = editor.state.tr;
  selection.forEachCell((cell: ProseMirrorNode, cellPos: number) => {
    const offset = cellPos - tableStart;
    if (seen.has(offset)) return;
    seen.add(offset);
    const emptyCell = cell.type.createChecked(cell.attrs, paragraphFragmentFromText(editor, ''), cell.marks);
    tr = tr.replaceWith(cellPos, cellPos + cell.nodeSize, emptyCell);
  });
  if (!tr.docChanged || map.width === 0) return false;
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

function buildTableIdentityTransaction(state: EditorState) {
  let tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return;
    const tableId = sanitizeFeishuBlockId(node.attrs.blockId)
      ?? sanitizeFeishuBlockId(node.attrs.tableId)
      ?? createStableId('table');
    const tableAttrs = node.attrs.tableId === tableId && node.attrs.blockId === tableId
      ? node.attrs
      : { ...node.attrs, tableId, blockId: tableId };
    if (tableAttrs !== node.attrs) tr = tr.setNodeMarkup(pos, undefined, tableAttrs);
    node.forEach((row, rowOffset, rowIndex) => {
      const rowPos = pos + 1 + rowOffset;
      const rowAttrs = row.attrs.rowId && row.attrs.rowIndex === rowIndex
        ? row.attrs
        : { ...row.attrs, rowId: row.attrs.rowId || createStableId('row'), rowIndex };
      if (rowAttrs !== row.attrs) tr = tr.setNodeMarkup(rowPos, undefined, rowAttrs);
      let colIndex = 0;
      row.forEach((cell, cellOffset) => {
        const cellPos = rowPos + 1 + cellOffset;
        const colspan = Math.max(1, Number(cell.attrs.colspan || 1));
        const cellAttrs =
          cell.attrs.cellId
          && cell.attrs.rowIndex === rowIndex
          && cell.attrs.colIndex === colIndex
            ? cell.attrs
            : {
                ...cell.attrs,
                cellId: cell.attrs.cellId || createStableId('cell'),
                rowIndex,
                colIndex,
              };
        if (cellAttrs !== cell.attrs) tr = tr.setNodeMarkup(cellPos, undefined, cellAttrs);
        colIndex += colspan;
      });
    });
    return false;
  });
  return tr.docChanged ? tr : null;
}

const FeishuTableIdentity = Extension.create({
  name: 'feishuTableIdentity',
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('feishuTableIdentity'),
        view(view) {
          let frame: number | null = window.requestAnimationFrame(() => {
            frame = null;
            const tr = buildTableIdentityTransaction(view.state);
            if (tr) view.dispatch(tr);
          });
          return {
            update(nextView) {
              if (frame != null) return;
              frame = window.requestAnimationFrame(() => {
                frame = null;
                const tr = buildTableIdentityTransaction(nextView.state);
                if (tr) nextView.dispatch(tr);
              });
            },
            destroy() {
              if (frame != null) window.cancelAnimationFrame(frame);
            },
          };
        },
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some(tr => tr.docChanged)) return null;
          return buildTableIdentityTransaction(newState);
        },
      }),
    ];
  },
});

const FeishuTableInteractions = Extension.create({
  name: 'feishuTableInteractions',
  priority: 900,

  addKeyboardShortcuts() {
    return {
      Escape: ({ editor }) => {
        const { selection } = editor.state;
        if (!(selection instanceof CellSelection)) return false;
        editor.commands.setTextSelection(selection.$anchorCell.pos + 1);
        return true;
      },
      Delete: ({ editor }) => clearSelectedCells(editor),
      Backspace: ({ editor }) => clearSelectedCells(editor),
      'Mod-a': ({ editor }) => {
        const { selection } = editor.state;
        if (selection instanceof CellSelection) {
          const tableDepth = selection.$anchorCell.depth - 1;
          return editor.chain().focus().setNodeSelection(selection.$anchorCell.before(tableDepth)).run();
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('feishuTableInteractions'),
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              const element = closestElement(event.target);
              if (!element) return false;
              if (isTableUiTarget(event.target)) {
                event.stopPropagation();
                return false;
              }
              const tableHost = element.closest('.feishu-table-host, .tableWrapper');
              if (!tableHost) return false;
              document.querySelectorAll('.feishu-table-host.is-table-block-active, .tableWrapper.is-table-block-active')
                .forEach(host => host.classList.remove('is-table-block-active'));
              const cell = resolveCellElement(event.target);
              if (cell && !textNodeClientRectsContainPoint(cell, event.clientX, event.clientY)) {
                return beginCellRangeDrag(view, event, cell);
              }
              if (view.state.selection instanceof NodeSelection) {
                const pos = view.posAtDOM(element.closest('td, th') ?? tableHost, 0);
                view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos), 1)));
              }
              return false;
            },
            copy: (_view, event) => copyCellSelection(editor, event),
            paste: (_view, event) => {
              if (!isSelectionInsideTable(editor.state.selection)) return false;
              const matrix = matrixFromCustomClipboard(event.clipboardData?.getData(TABLE_MIME) ?? '')
                ?? matrixFromClipboard(
                event.clipboardData?.getData('text/html') ?? '',
                event.clipboardData?.getData('text/plain') ?? '',
              );
              if (!matrix) return false;
              event.preventDefault();
              return writeCellMatrix(editor, matrix);
            },
          },
        },
      }),
    ];
  },
});

/**
 * 飞书富文本表格扩展。
 * resizable:false 时 TipTap 不会挂载 TableView，DOM 无 tableWrapper，行列 UI 无法定位。
 * 此处始终使用 FeishuTableView 包裹 table + tbody。
 */
export const FeishuTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableId: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id') || element.getAttribute('data-table-id'),
        renderHTML: attributes => {
          const id = sanitizeFeishuBlockId(attributes.blockId) ?? sanitizeFeishuBlockId(attributes.tableId);
          return {
            'data-block-id': id,
            'data-table-id': id,
            'data-block-type': 'table',
            'data-table-root': 'true',
          };
        },
      },
    };
  },
  addNodeView() {
    return ({ node }) =>
      new FeishuTableView(node, this.options.cellMinWidth, TABLE_CLASS);
  },
}).configure({
  resizable: false,
  cellMinWidth: 120,
  HTMLAttributes: { class: TABLE_CLASS },
  allowTableNodeSelection: true,
});

export const FeishuTableRowWithIdentity = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rowId: {
        default: null,
        parseHTML: element => element.getAttribute('data-row-id'),
        renderHTML: attributes => ({ 'data-row-id': attributes.rowId }),
      },
      rowIndex: {
        default: null,
        parseHTML: element => {
          const value = element.getAttribute('data-row-index');
          return value == null ? null : Number(value);
        },
        renderHTML: attributes => ({ 'data-row-index': attributes.rowIndex }),
      },
      rowHeight: {
        default: null,
        parseHTML: element => {
          const value = element.getAttribute('data-row-height') || element.style.height;
          return value ? Number.parseInt(value, 10) : null;
        },
        renderHTML: attributes => {
          if (!attributes.rowHeight) return {};
          return {
            'data-row-height': attributes.rowHeight,
            style: `height: ${attributes.rowHeight}px`,
          };
        },
      },
    };
  },
});
export const FeishuTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      cellId: {
        default: null,
        parseHTML: element => element.getAttribute('data-cell-id'),
        renderHTML: attributes => ({ 'data-cell-id': attributes.cellId }),
      },
      rowIndex: {
        default: null,
        parseHTML: element => Number(element.getAttribute('data-row-index') || 0),
        renderHTML: attributes => ({ 'data-row-index': attributes.rowIndex }),
      },
      colIndex: {
        default: null,
        parseHTML: element => Number(element.getAttribute('data-col-index') || 0),
        renderHTML: attributes => ({ 'data-col-index': attributes.colIndex }),
      },
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || null,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {};
          return { style: `background-color: ${attributes.backgroundColor}` };
        },
      },
      hiddenByMerge: {
        default: false,
        parseHTML: element => element.getAttribute('data-hidden-by-merge') === 'true',
        renderHTML: attributes => attributes.hiddenByMerge ? { 'data-hidden-by-merge': 'true' } : {},
      },
      mergeRootCellId: {
        default: null,
        parseHTML: element => element.getAttribute('data-merge-root-cell-id'),
        renderHTML: attributes => attributes.mergeRootCellId ? { 'data-merge-root-cell-id': attributes.mergeRootCellId } : {},
      },
    };
  },
}).configure({
  HTMLAttributes: {
    class: 'feishu-table__header-cell',
    'data-table-cell': 'true',
  },
});

export const FeishuTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      cellId: {
        default: null,
        parseHTML: element => element.getAttribute('data-cell-id'),
        renderHTML: attributes => ({ 'data-cell-id': attributes.cellId }),
      },
      rowIndex: {
        default: null,
        parseHTML: element => Number(element.getAttribute('data-row-index') || 0),
        renderHTML: attributes => ({ 'data-row-index': attributes.rowIndex }),
      },
      colIndex: {
        default: null,
        parseHTML: element => Number(element.getAttribute('data-col-index') || 0),
        renderHTML: attributes => ({ 'data-col-index': attributes.colIndex }),
      },
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || null,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {};
          return { style: `background-color: ${attributes.backgroundColor}` };
        },
      },
      hiddenByMerge: {
        default: false,
        parseHTML: element => element.getAttribute('data-hidden-by-merge') === 'true',
        renderHTML: attributes => attributes.hiddenByMerge ? { 'data-hidden-by-merge': 'true' } : {},
      },
      mergeRootCellId: {
        default: null,
        parseHTML: element => element.getAttribute('data-merge-root-cell-id'),
        renderHTML: attributes => attributes.mergeRootCellId ? { 'data-merge-root-cell-id': attributes.mergeRootCellId } : {},
      },
    };
  },
}).configure({
  HTMLAttributes: {
    class: 'feishu-table__cell',
    'data-table-cell': 'true',
  },
});

export const feishuTableExtensions = [
  FeishuTable,
  FeishuTableRowWithIdentity,
  FeishuTableHeader,
  FeishuTableCell,
  FeishuTableIdentity,
  FeishuTableInteractions,
];
