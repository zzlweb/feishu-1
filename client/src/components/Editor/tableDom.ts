import type { Editor } from '@tiptap/react';
import { CellSelection, TableMap } from '@tiptap/pm/tables';

const HOST_SELECTOR = '.feishu-table-host, .tableWrapper';

const TABLE_UI_SELECTOR =
  '.feishu-table-chrome, .feishu-table-host, .tableWrapper, .selection-bubble, .context-menu, .context-submenu-flyout';

/** 焦点是否仍在表格相关 UI（编辑区、操作轨、选区气泡、表格菜单） */
export function isFocusInTableUi(
  editor: Editor | null,
  activeElement: Element | null = document.activeElement,
  relatedTarget?: EventTarget | null,
): boolean {
  const probe = (el: Element | null) => {
    if (!el) return false;
    if (el.closest(TABLE_UI_SELECTOR)) return true;
    if (editor?.view.dom.contains(el)) return true;
    return false;
  };

  if (activeElement instanceof Element && probe(activeElement)) return true;
  if (relatedTarget instanceof Element && probe(relatedTarget)) return true;
  return false;
}

function resolveHostFromTableDom(editor: Editor, tablePos: number): HTMLElement | null {
  if (!editor.view?.dom) return null;
  const dom = editor.view.nodeDOM(tablePos);
  if (!(dom instanceof HTMLElement)) return null;
  if (dom.matches(HOST_SELECTOR)) return dom;
  if (dom.tagName === 'TABLE') {
    const parent = dom.parentElement;
    if (parent?.matches(HOST_SELECTOR)) return parent as HTMLElement;
  }
  const nested = dom.querySelector(HOST_SELECTOR) ?? dom.closest(HOST_SELECTOR);
  return nested instanceof HTMLElement ? nested : null;
}

/** 当前 CellSelection 对应的表格宿主 */
export function resolveTableHostFromCellSelection(editor: Editor): HTMLElement | null {
  const { selection } = editor.state;
  if (!(selection instanceof CellSelection)) return null;
  const $anchor = selection.$anchorCell;
  for (let d = $anchor.depth; d > 0; d--) {
    if ($anchor.node(d).type.name === 'table') {
      return resolveHostFromTableDom(editor, $anchor.before(d));
    }
  }
  return null;
}

/** CellSelection 是否落在指定表格宿主内（按 DOM 宿主比对，避免 pos 解析偏差） */
export function isCellSelectionInTableHost(editor: Editor, host: HTMLElement): boolean {
  const selectionHost = resolveTableHostFromCellSelection(editor);
  if (!selectionHost) return false;
  return selectionHost === host || host.contains(selectionHost) || selectionHost.contains(host);
}

export type TableRailPin = { kind: 'col' | 'row'; index: number };

const RAIL_SELECTED_CLASS = 'feishu-table__cell--rail-selected';

/** 根据本地列/行选中状态同步单元格高亮 class（仅在 class 变化时写 DOM，避免 MutationObserver 死循环） */
export function syncTableRailCellHighlight(
  host: HTMLElement,
  pin: TableRailPin | null,
  editor?: Editor | null,
) {
  const table = getTableElementFromHost(host);
  if (!table) return;

  const cells = Array.from(table.querySelectorAll('th, td'));
  const nextSelected = new Set<HTMLElement>();

  if (pin) {
    let resolvedByMap = false;
    if (editor?.view?.dom) {
      const tablePos = getTablePosFromHost(editor, host);
      const tableNode = tablePos != null ? editor.state.doc.nodeAt(tablePos) : null;
      if (tablePos != null && tableNode) {
        const map = TableMap.get(tableNode);
        const tableStart = tablePos + 1;
        const markCellAt = (row: number, col: number) => {
          if (row < 0 || col < 0 || row >= map.height || col >= map.width) return;
          const cellPos = tableStart + map.map[row * map.width + col];
          const dom = editor.view.nodeDOM(cellPos);
          if (dom instanceof HTMLElement) nextSelected.add(dom);
        };
        if (pin.kind === 'col') {
          for (let row = 0; row < map.height; row += 1) markCellAt(row, pin.index);
        } else {
          for (let col = 0; col < map.width; col += 1) markCellAt(pin.index, col);
        }
        resolvedByMap = true;
      }
    }
    if (!resolvedByMap) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (pin.kind === 'col') {
        rows.forEach(tr => {
          const cell = tr.querySelectorAll('th, td')[pin.index];
          if (cell instanceof HTMLElement) nextSelected.add(cell);
        });
      } else {
        const row = rows[pin.index];
        row?.querySelectorAll('th, td').forEach(cell => {
          if (cell instanceof HTMLElement) nextSelected.add(cell);
        });
      }
    }
  }

  cells.forEach(cell => {
    if (!(cell instanceof HTMLElement)) return;
    const shouldSelect = nextSelected.has(cell);
    const isSelected = cell.classList.contains(RAIL_SELECTED_CLASS);
    if (shouldSelect && !isSelected) cell.classList.add(RAIL_SELECTED_CLASS);
    else if (!shouldSelect && isSelected) cell.classList.remove(RAIL_SELECTED_CLASS);
  });
}

/** 解析单元格在文档中的位置（cell 节点前） */
export function resolveTableCellPos(
  editor: Editor,
  tablePos: number,
  row: number,
  col: number,
): number | null {
  const tableNode = editor.state.doc.nodeAt(tablePos);
  if (!tableNode) return null;
  const map = TableMap.get(tableNode);
  if (row < 0 || col < 0 || row >= map.height || col >= map.width) return null;
  const index = row * map.width + col;
  const tableStart = tablePos + 1;
  return tableStart + map.map[index];
}

/** 表格宿主：NodeView 外层 div（含 tableWrapper + feishu-table-host） */
export function resolveTableHostFromElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const host = target.closest(HOST_SELECTOR) as HTMLElement | null;
  if (host) return host;
  const table = target.closest('table.feishu-table') as HTMLTableElement | null;
  if (!table) return null;
  const parent = table.parentElement;
  if (parent?.matches(HOST_SELECTOR)) return parent as HTMLElement;
  return table;
}

export function getTableElementFromHost(host: HTMLElement): HTMLTableElement | null {
  if (host.tagName === 'TABLE') return host as HTMLTableElement;
  return host.querySelector('table.feishu-table, table');
}

/** 表格横向滚动容器（与操作层宿主分离，避免 hover 时滚动条撑开布局） */
export function getTableScrollFromHost(host: HTMLElement): HTMLElement {
  return (host.querySelector('.feishu-table-scroll') as HTMLElement | null) ?? host;
}

function getTableEdgeFadesFromHost(host: HTMLElement) {
  const root = host.querySelector('.feishu-table-edge-fades');
  if (!(root instanceof HTMLElement)) return null;
  const left = root.querySelector('.feishu-table-edge-fade--left');
  const right = root.querySelector('.feishu-table-edge-fade--right');
  if (!(left instanceof HTMLElement) || !(right instanceof HTMLElement)) return null;
  return { left, right };
}

/** 旧表格 DOM 无渐隐层时按需补全 */
function ensureTableEdgeFades(host: HTMLElement) {
  const existing = getTableEdgeFadesFromHost(host);
  if (existing) return existing;

  const surface = getTableScrollFromHost(host);
  if (surface === host) return null;

  const edgeFades = document.createElement('div');
  edgeFades.className = 'feishu-table-edge-fades';
  edgeFades.setAttribute('aria-hidden', 'true');

  const edgeFadeLeft = document.createElement('div');
  edgeFadeLeft.className = 'feishu-table-edge-fade feishu-table-edge-fade--left';
  const edgeFadeRight = document.createElement('div');
  edgeFadeRight.className = 'feishu-table-edge-fade feishu-table-edge-fade--right';
  edgeFades.appendChild(edgeFadeLeft);
  edgeFades.appendChild(edgeFadeRight);
  surface.insertAdjacentElement('afterend', edgeFades);

  return { left: edgeFadeLeft, right: edgeFadeRight };
}

/** 同步左右渐隐阴影：只要表格横向溢出文档区域就持续显示 */
export function syncTableScrollEdgeFade(host: HTMLElement, _show: boolean) {
  const surface = getTableScrollFromHost(host);
  const edgeFades = ensureTableEdgeFades(host);

  const setSurfaceFade = (right: boolean, left: boolean) => {
    const hasRight = surface.classList.contains('feishu-table-scroll--fade-right');
    const hasLeft = surface.classList.contains('feishu-table-scroll--fade-left');
    if (right !== hasRight) surface.classList.toggle('feishu-table-scroll--fade-right', right);
    if (left !== hasLeft) surface.classList.toggle('feishu-table-scroll--fade-left', left);
  };

  const setEdgeFadeVisible = (right: boolean, left: boolean) => {
    if (!edgeFades) return;
    const hasRight = edgeFades.right.classList.contains('is-visible');
    const hasLeft = edgeFades.left.classList.contains('is-visible');
    if (right !== hasRight) edgeFades.right.classList.toggle('is-visible', right);
    if (left !== hasLeft) edgeFades.left.classList.toggle('is-visible', left);
    setSurfaceFade(false, false);
  };

  const maxScroll = surface.scrollWidth - surface.clientWidth;
  const hasOverflow = maxScroll > 2;
  if (!hasOverflow) {
    setEdgeFadeVisible(false, false);
    setSurfaceFade(false, false);
    return;
  }

  const atStart = surface.scrollLeft <= 1;
  const atEnd = surface.scrollLeft >= maxScroll - 1;
  const showRight = !atEnd;
  const showLeft = !atStart;

  if (edgeFades) {
    setEdgeFadeVisible(showRight, showLeft);
    return;
  }

  setSurfaceFade(showRight, showLeft);
}

/** NodeView 内预留的操作层挂载点（避免 Portal 挂在 host 根上被 ProseMirror 清掉） */
export function getTableChromeMountFromHost(host: HTMLElement): HTMLElement {
  return (
    (host.querySelector('.feishu-table-chrome-mount') as HTMLElement | null)
    ?? host
  );
}

/** 解析表格节点在文档中的起始位置 */
export function getTablePosFromHost(editor: Editor, host: HTMLElement): number | null {
  if (!host.isConnected || !editor.view?.dom?.contains(host)) return null;

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

export function resolveTableHostFromEditor(editor: Editor): HTMLElement | null {
  const { selection } = editor.state;
  const $probe = selection instanceof CellSelection ? selection.$anchorCell : selection.$from;
  for (let d = $probe.depth; d > 0; d--) {
    if ($probe.node(d).type.name !== 'table') continue;
    const pos = $probe.before(d);
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) {
      if (dom.matches(HOST_SELECTOR)) return dom;
      if (dom.tagName === 'TABLE') {
        const parent = dom.parentElement;
        if (parent?.matches(HOST_SELECTOR)) return parent;
        return dom;
      }
      const nested = dom.querySelector(HOST_SELECTOR) ?? dom.querySelector('table.feishu-table');
      if (nested instanceof HTMLElement) {
        return nested.matches(HOST_SELECTOR) ? nested : (nested.parentElement as HTMLElement) ?? nested;
      }
    }
  }
  return null;
}
