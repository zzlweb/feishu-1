import type { Editor } from '@tiptap/react';
import type { Node as ProseNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { getBlockAtPos } from './blockOperations';
import { resolveTableHostFromElement } from './tableDom';

export interface SelectableUnit {
  id: string;
  from: number;
  to: number;
  dom: HTMLElement;
  kind: 'block' | 'tableRow' | 'listItem';
}

export interface ClientRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BoxSelectionStore {
  getSelectedUnits: () => SelectableUnit[];
  selectUnits?: (units: SelectableUnit[]) => void;
  clearSelection: () => void;
  isActive: () => boolean;
  isMarqueeActive?: () => boolean;
}

export let boxSelectionStore: BoxSelectionStore | null = null;

export function setBoxSelectionStore(store: BoxSelectionStore | null): void {
  boxSelectionStore = store;
}

const UI_CHROME =
  '[data-no-marquee-selection="true"], [data-floating-panel="true"], [data-block-action-button="true"], [data-drag-handle="true"], .block-inline-tools, .block-add-hover-wrap, .block-add-btn, .block-drag-row, .drag-handle, .hover-drag-icon-wrapper, .feishu-table-chrome, .feishu-table-chrome-mount, .context-menu, .context-submenu-flyout, .context-add-below-flyout, .slash-menu, .slash-submenu-portal, .slash-table-grid-flyout, .slash-columns-count-flyout, .selection-bubble, .editor-page-link-pop, .feishu-box-selection-layer, .column-resize-handle, .block-plus-menu-shell, .feishu-columns-block__plus-menu-shell, .t-popup, .t-dialog, .t-dropdown, .t-select__dropdown';

const TABLE_INTERACTION_SELECTOR =
  '.feishu-table-host, .tableWrapper, table.feishu-table, .feishu-table-scroll';

function isUiChrome(target: EventTarget | null): boolean {
  const element = target instanceof Element
    ? target
    : target instanceof Text ? target.parentElement : null;
  return Boolean(element?.closest(UI_CHROME));
}

function getTiptapRoot(editorArea: HTMLElement): HTMLElement | null {
  return editorArea.querySelector('.tiptap, .ProseMirror');
}

function getTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Text) return target.parentElement;
  return null;
}

const INTERACTIVE_CONTROL_SELECTOR =
  'button, input, textarea, select, option, a, label, [role="button"]';

const WIDGET_BLOCK_SELECTOR =
  '[data-local-block], [contenteditable="false"], img, video, audio, iframe, .feishu-image-block, .feishu-local-card, .feishu-button-block, .feishu-formula-editor, .feishu-bitable-block, .feishu-sync-block, .feishu-media-preview, .feishu-file-actions, .feishu-divider, .feishu-code-block__toolbar, .feishu-highlight-block-wrap';

/** 判断 li 是否为任务列表项 */
export function isTaskListItem(li: Element | null): boolean {
  if (!li) return false;
  return Boolean(li.closest('ul[data-type="taskList"]'));
}

/** 待办项正文区域（不含 checkbox），允许从此处发起框选 / 点选 */
export function isTaskItemTextArea(element: Element): boolean {
  const li = element.closest('ul[data-type="taskList"] > li');
  if (!(li instanceof HTMLElement)) return false;
  if (element.closest('ul[data-type="taskList"] > li > label')) return false;
  return li.contains(element);
}

/** 列表项正文区域（有序 / 无序 / 待办），允许从此处发起框选 */
export function isListItemTextArea(element: Element): boolean {
  if (isTaskItemTextArea(element)) return true;
  const li = element.closest('ul:not([data-type="taskList"]) > li, ol > li');
  if (!(li instanceof HTMLElement)) return false;
  return li.contains(element);
}

export function isListTextPoint(element: Element, clientX: number, clientY: number): boolean {
  if (!isListItemTextArea(element)) return false;
  const li = element.closest('li');
  if (!li) return false;

  const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    if (!text.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(text);
    for (const rect of Array.from(range.getClientRects())) {
      if (
        clientX >= rect.left - 1
        && clientX <= rect.right + 1
        && clientY >= rect.top
        && clientY <= rect.bottom
      ) {
        return true;
      }
    }
  }
  return false;
}

export function isListSelectableUnit(unit: SelectableUnit): boolean {
  return unit.kind === 'listItem';
}

/** @deprecated 使用 isListSelectableUnit */
export function isTaskSelectableUnit(unit: SelectableUnit): boolean {
  return isListSelectableUnit(unit);
}

export function isListItemEmpty(li: HTMLElement): boolean {
  const text = li.textContent?.replace(/\u200b/g, '').trim() ?? '';
  return text.length === 0;
}

/** 控件或块级 widget 已占位的区域，不允许作为框选起点 */
export function isControlOccupiedElement(element: Element): boolean {
  if (element.closest('ul[data-type="taskList"] > li > label')) return true;
  if (element.closest(INTERACTIVE_CONTROL_SELECTOR)) return true;
  if (element.closest(WIDGET_BLOCK_SELECTOR)) return true;
  return false;
}

function resolvePointElement(
  target: EventTarget | null,
  clientX?: number,
  clientY?: number,
): Element | null {
  if (clientX != null && clientY != null) {
    const hit = document.elementFromPoint(clientX, clientY);
    const fromPoint = getTargetElement(hit);
    if (fromPoint) return fromPoint;
  }
  return getTargetElement(target);
}

function isTableInteractionTarget(element: Element): boolean {
  return Boolean(element.closest(TABLE_INTERACTION_SELECTOR));
}

/** 点击是否落在顶层块之间的空白区（含最后一个块下方） */
function isBlankEditorPoint(clientX: number, clientY: number, tiptap: HTMLElement): boolean {
  const editorRect = tiptap.getBoundingClientRect();
  if (clientX < editorRect.left || clientX > editorRect.right) return false;

  const children = Array.from(tiptap.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  if (children.length === 0) return true;

  for (const child of children) {
    const rect = child.getBoundingClientRect();
    if (
      clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom
    ) {
      return false;
    }
  }

  const firstRect = children[0].getBoundingClientRect();
  if (clientY < firstRect.top - 4) return true;

  for (let i = 0; i < children.length - 1; i += 1) {
    const topRect = children[i].getBoundingClientRect();
    const bottomRect = children[i + 1].getBoundingClientRect();
    if (clientY > topRect.bottom + 2 && clientY < bottomRect.top - 2) return true;
  }

  const lastRect = children[children.length - 1].getBoundingClientRect();
  return clientY > lastRect.bottom + 4;
}

function resolveListItemRange(editor: Editor, li: HTMLElement): { from: number; to: number } | null {
  try {
    const pos = editor.view.posAtDOM(li, 0);
    const block = getBlockAtPos(editor, pos);
    if (!block) return null;
    if (block.node.type.name !== 'listItem' && block.node.type.name !== 'taskItem') return null;
    return { from: block.from, to: block.to };
  } catch {
    return null;
  }
}

function resolveBlockRange(editor: Editor, dom: HTMLElement): { from: number; to: number } | null {
  try {
    const pos = editor.view.posAtDOM(dom, 0);
    const preferredType =
      dom.closest('.feishu-table-host, .tableWrapper') ? 'table'
      : dom.closest('.feishu-sync-block') ? 'localSyncBlock'
      : dom.closest('.feishu-bitable-block') ? 'localBitableBlock'
      : dom.closest('.feishu-div-table') ? 'localDivTableBlock'
      : dom.closest('.feishu-button-block') ? 'localButtonBlock'
      : dom.closest('.feishu-formula-editor') ? 'localFormulaBlock'
      : dom.closest('.feishu-file-block') ? 'localFileBlock'
      : dom.closest('.feishu-local-card') ? 'localEmbedBlock'
      : dom.closest('.feishu-divider') ? 'horizontalRule'
      : dom.closest('.feishu-highlight-block-wrap') ? 'highlightBlock'
      : null;

    if (preferredType) {
      const directNode = editor.state.doc.nodeAt(pos);
      if (directNode?.type.name === preferredType) {
        return { from: pos, to: pos + directNode.nodeSize };
      }

      const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
      for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth);
        if (node.type.name !== preferredType) continue;
        const from = $pos.before(depth);
        return { from, to: from + node.nodeSize };
      }
    }

    const block = getBlockAtPos(editor, pos);
    if (!block) return null;
    return { from: block.from, to: block.to };
  } catch {
    return null;
  }
}

function pushUnit(
  units: SelectableUnit[],
  seen: Set<string>,
  unit: SelectableUnit | null,
): void {
  if (!unit || seen.has(unit.id)) return;
  seen.add(unit.id);
  units.push(unit);
}

function collectListItemsFromLists(
  editor: Editor,
  lists: Iterable<Element>,
  units: SelectableUnit[],
  seen: Set<string>,
): void {
  for (const list of lists) {
    if (!(list instanceof HTMLElement)) continue;
    Array.from(list.querySelectorAll(':scope > li')).forEach((li, itemIndex) => {
      if (!(li instanceof HTMLElement)) return;
      const range = resolveListItemRange(editor, li);
      if (!range) return;
      pushUnit(units, seen, {
        id: `li-${range.from}-${itemIndex}`,
        from: range.from,
        to: range.to,
        dom: li,
        kind: 'listItem',
      });
    });
  }
}

/** 表格内已选中列表项时，不再选中整张表，避免误删 */
export function normalizeSelectedUnits(units: SelectableUnit[]): SelectableUnit[] {
  const listItems = units.filter(unit => unit.kind === 'listItem');
  if (listItems.length === 0) return units;

  return units.filter(unit => {
    if (unit.kind !== 'block') return true;
    const tableHost = unit.dom.matches('.feishu-table-host, .tableWrapper')
      ? unit.dom
      : resolveTableHostFromElement(unit.dom);
    if (!tableHost) return true;
    return !listItems.some(item => tableHost.contains(item.dom));
  });
}

/** 从 DOM 顶层块收集可框选项（比 nodeDOM 更稳定） */
function collectFromContainer(editor: Editor, container: HTMLElement, units: SelectableUnit[], seen: Set<string>): void {
  for (const child of Array.from(container.children)) {
    if (!(child instanceof HTMLElement)) continue;

    const tableHost = child.matches('.feishu-table-host, .tableWrapper')
      ? child
      : resolveTableHostFromElement(child);
    if (tableHost) {
      const range = resolveBlockRange(editor, tableHost);
      pushUnit(units, seen, range && {
        id: `block-${range.from}`,
        from: range.from,
        to: range.to,
        dom: tableHost,
        kind: 'block',
      });
      collectListItemsFromLists(editor, tableHost.querySelectorAll('ul, ol'), units, seen);
      continue;
    }

    if (child.classList.contains('feishu-columns-node') || child.classList.contains('feishu-columns-block')) {
      Array.from(child.querySelectorAll(':scope .feishu-columns-block__col')).forEach(column => {
        if (column instanceof HTMLElement) collectFromContainer(editor, column, units, seen);
      });
      continue;
    }

    const tag = child.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      collectListItemsFromLists(editor, [child], units, seen);
      continue;
    }

    const blockEl =
      child.classList.contains('feishu-code-block') ? child
      : child.classList.contains('feishu-highlight-block-wrap') ? child
      : child.classList.contains('feishu-divider') ? child
      : child.matches('.feishu-image-block-wrap, .feishu-file-block, .feishu-button-block, .feishu-formula-editor, .feishu-bitable-block, .feishu-sync-block, .feishu-local-card, [data-local-block]') ? child
      : child;

    const range = resolveBlockRange(editor, blockEl);
    if (!range) continue;

    pushUnit(units, seen, {
      id: `block-${range.from}`,
      from: range.from,
      to: range.to,
      dom: blockEl,
      kind: 'block',
    });
  }

}

export function collectSelectableUnits(editor: Editor): SelectableUnit[] {
  const units: SelectableUnit[] = [];
  const seen = new Set<string>();
  collectFromContainer(editor, editor.view.dom as HTMLElement, units, seen);
  return units;
}

export function normalizeClientRect(a: ClientRect, b: ClientRect): ClientRect {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

export function clientRectsIntersect(a: ClientRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function findUnitsInClientRect(editor: Editor, rect: ClientRect): SelectableUnit[] {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (width < 2 && height < 2) return [];

  const matched = collectSelectableUnits(editor).filter(unit => {
    if (!unit.dom.isConnected) return false;
    const bounds = unit.dom.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && clientRectsIntersect(rect, bounds);
  });
  return normalizeSelectedUnits(matched);
}

export function findSelectableUnitAtPoint(editor: Editor, clientX: number, clientY: number): SelectableUnit | null {
  const hits = collectSelectableUnits(editor).filter(unit => {
    if (!unit.dom.isConnected) return false;
    const rect = unit.dom.getBoundingClientRect();
    return (
      clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom
    );
  });
  if (hits.length === 0) return null;
  return hits.sort((a, b) => {
    const ar = a.dom.getBoundingClientRect();
    const br = b.dom.getBoundingClientRect();
    return (ar.width * ar.height) - (br.width * br.height);
  })[0];
}

function expandListDeleteRange(doc: ProseNode, from: number, to: number): { from: number; to: number } {
  try {
    const clamped = Math.max(0, Math.min(from, doc.content.size));
    const $from = doc.resolve(clamped);

    const parentType = $from.parent.type.name;
    const nodeAfter = $from.nodeAfter;
    if (
      (parentType === 'bulletList' || parentType === 'orderedList' || parentType === 'taskList')
      && (nodeAfter?.type.name === 'listItem' || nodeAfter?.type.name === 'taskItem')
      && clamped + nodeAfter.nodeSize === to
      && $from.parent.childCount === 1
      && $from.depth > 0
    ) {
      const parentFrom = $from.before($from.depth);
      return { from: parentFrom, to: parentFrom + $from.parent.nodeSize };
    }

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== 'listItem' && node.type.name !== 'taskItem') continue;
      const parent = $from.node(depth - 1);
      if (parent.childCount === 1) {
        const parentFrom = $from.before(depth - 1);
        return { from: parentFrom, to: parentFrom + parent.nodeSize };
      }
      return { from, to };
    }
  } catch {
    /* keep range */
  }
  return { from, to };
}

export function deleteSelectableUnits(editor: Editor, units: SelectableUnit[]): boolean {
  if (units.length === 0) return false;

  const ranges = units
    .map(u => ({ from: u.from, to: u.to }))
    .sort((a, b) => b.from - a.from);

  let tr = editor.state.tr;
  for (const { from, to } of ranges) {
    const expanded = expandListDeleteRange(tr.doc, from, to);
    if (expanded.from >= 0 && expanded.to <= tr.doc.content.size && expanded.from < expanded.to) {
      tr = tr.delete(expanded.from, expanded.to);
    }
  }

  if (tr.doc.childCount === 0) {
    const paragraph = editor.schema.nodes.paragraph?.createAndFill();
    if (paragraph) tr = tr.insert(0, paragraph);
  }

  if (tr.doc.content.size > 0) {
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(1), 1));
  }

  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

export async function copySelectableUnits(editor: Editor, units: SelectableUnit[]): Promise<boolean> {
  if (units.length === 0) return false;
  const text = units
    .slice()
    .sort((a, b) => a.from - b.from)
    .map(unit => editor.state.doc.textBetween(unit.from, unit.to, '\n', '\n').trim())
    .filter(Boolean)
    .join('\n\n');
  if (!text) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

function unitParentKey(editor: Editor, unit: SelectableUnit): string | null {
  try {
    const $pos = editor.state.doc.resolve(unit.from);
    return $pos.depth > 0 ? String($pos.before($pos.depth)) : 'doc';
  } catch {
    return null;
  }
}

export function moveSelectableUnits(editor: Editor, units: SelectableUnit[], direction: 'up' | 'down'): boolean {
  if (units.length === 0) return false;

  const allUnits = collectSelectableUnits(editor);
  const selectedIds = new Set(units.map(unit => unit.id));
  const selectedIndexes = allUnits
    .map((unit, index) => selectedIds.has(unit.id) ? index : -1)
    .filter(index => index >= 0);
  if (selectedIndexes.length === 0) return false;

  const firstIndex = Math.min(...selectedIndexes);
  const lastIndex = Math.max(...selectedIndexes);
  if (lastIndex - firstIndex + 1 !== selectedIndexes.length) return false;

  const neighbor = direction === 'up' ? allUnits[firstIndex - 1] : allUnits[lastIndex + 1];
  if (!neighbor) return false;

  const sortedSelected = allUnits.slice(firstIndex, lastIndex + 1);
  const parentKey = unitParentKey(editor, sortedSelected[0]);
  if (!parentKey || sortedSelected.some(unit => unitParentKey(editor, unit) !== parentKey)) return false;
  if (unitParentKey(editor, neighbor) !== parentKey) return false;

  const from = sortedSelected[0].from;
  const to = sortedSelected[sortedSelected.length - 1].to;
  const slice = editor.state.doc.slice(from, to);
  let tr = editor.state.tr;

  if (direction === 'up') {
    tr = tr.delete(from, to).insert(neighbor.from, slice.content);
  } else {
    tr = tr.delete(from, to).insert(neighbor.to - (to - from), slice.content);
  }

  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/** 文档编辑区域：仅从块间空白或编辑区边距按下左键拖动框选。 */
export function canStartBoxSelect(
  target: EventTarget | null,
  editorArea: HTMLElement,
  clientX?: number,
  clientY?: number,
): boolean {
  const element = resolvePointElement(target, clientX, clientY);
  if (!element) return false;
  if (!editorArea.contains(element)) return false;
  if (isUiChrome(element)) return false;
  if (isTableInteractionTarget(element)) return false;
  if (isControlOccupiedElement(element)) return false;

  const tiptap = getTiptapRoot(editorArea);
  if (!tiptap || clientX == null || clientY == null) return false;

  const areaRect = editorArea.getBoundingClientRect();
  const tiptapRect = tiptap.getBoundingClientRect();
  if (
    clientX >= areaRect.left
    && clientX <= areaRect.right
    && clientY >= areaRect.top
    && clientY <= areaRect.bottom
    && (clientX < tiptapRect.left || clientX > tiptapRect.right)
  ) {
    return true;
  }

  return isBlankEditorPoint(clientX, clientY, tiptap);
}

/** 兼容旧入口：判断正文区域是否可用于框选 */
export function canArmBoxSelect(
  target: EventTarget | null,
  editorArea: HTMLElement,
  clientX?: number,
  clientY?: number,
): boolean {
  return canStartBoxSelect(target, editorArea, clientX, clientY);
}

export function measureUnitBand(
  unit: SelectableUnit,
  areaRect: DOMRect,
): { top: number; left: number; width: number; height: number } {
  const r = unit.dom.getBoundingClientRect();
  return {
    top: r.top - areaRect.top,
    left: r.left - areaRect.left,
    width: r.width,
    height: r.height,
  };
}
