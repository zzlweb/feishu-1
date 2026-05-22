import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { getBlockAtPos } from './blockOperations';
import { getTableElementFromHost, resolveTableHostFromElement } from './tableDom';

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
  clearSelection: () => void;
  isActive: () => boolean;
}

export let boxSelectionStore: BoxSelectionStore | null = null;

export function setBoxSelectionStore(store: BoxSelectionStore | null): void {
  boxSelectionStore = store;
}

const UI_CHROME =
  '.block-inline-tools, .feishu-table-chrome, .feishu-table-chrome-mount, .context-menu, .context-submenu-flyout, .context-add-below-flyout, .slash-menu, .slash-submenu-portal, .slash-table-grid-flyout, .selection-bubble, .editor-page-link-pop, .feishu-box-selection-layer, .column-resize-handle, .block-plus-menu-shell';

const TABLE_INTERACTION_SELECTOR =
  '.feishu-table-host, .tableWrapper, table.feishu-table, .feishu-table-scroll, .feishu-columns-node, .feishu-columns-block';

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

function isNativeInteractiveElement(element: Element): boolean {
  return Boolean(element.closest('button, input, textarea, select, option, [contenteditable="false"]'));
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

function resolveRowRange(editor: Editor, tr: HTMLElement): { from: number; to: number } | null {
  try {
    const pos = editor.view.posAtDOM(tr, 0);
    const $pos = editor.state.doc.resolve(pos);
    for (let depth = $pos.depth; depth > 0; depth--) {
      if ($pos.node(depth).type.name !== 'tableRow') continue;
      const from = $pos.before(depth);
      const node = $pos.node(depth);
      return { from, to: from + node.nodeSize };
    }
  } catch {
    /* ignore */
  }
  return null;
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

/** 从 DOM 顶层块收集可框选项（比 nodeDOM 更稳定） */
export function collectSelectableUnits(editor: Editor): SelectableUnit[] {
  const units: SelectableUnit[] = [];
  const seen = new Set<string>();
  const root = editor.view.dom as HTMLElement;

  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) continue;

    const tableHost = child.matches('.feishu-table-host, .tableWrapper')
      ? child
      : resolveTableHostFromElement(child);
    if (tableHost) {
      const table = getTableElementFromHost(tableHost);
      if (table) {
        Array.from(table.querySelectorAll('tr')).forEach((tr, rowIndex) => {
          if (!(tr instanceof HTMLElement)) return;
          const range = resolveRowRange(editor, tr);
          if (!range) return;
          pushUnit(units, seen, {
            id: `tr-${range.from}`,
            from: range.from,
            to: range.to,
            dom: tr,
            kind: 'tableRow',
          });
        });
      }
      continue;
    }

    const tag = child.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      Array.from(child.querySelectorAll(':scope > li')).forEach((li, itemIndex) => {
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
      continue;
    }

    const blockEl =
      child.classList.contains('feishu-code-block') ? child
      : child.classList.contains('feishu-highlight-block-wrap') ? child
      : child.classList.contains('feishu-divider') ? child
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

  return collectSelectableUnits(editor).filter(unit => {
    if (!unit.dom.isConnected) return false;
    const bounds = unit.dom.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && clientRectsIntersect(rect, bounds);
  });
}

export function deleteSelectableUnits(editor: Editor, units: SelectableUnit[]): boolean {
  if (units.length === 0) return false;

  const ranges = units
    .map(u => ({ from: u.from, to: u.to }))
    .sort((a, b) => b.from - a.from);

  let tr = editor.state.tr;
  for (const { from, to } of ranges) {
    if (from >= 0 && to <= tr.doc.content.size && from < to) {
      tr = tr.delete(from, to);
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

/** 文档编辑区域：仅在空白区域按下左键拖动才开始框选块内容 */
export function canStartBoxSelect(
  target: EventTarget | null,
  editorArea: HTMLElement,
  clientX?: number,
  clientY?: number,
): boolean {
  const element = getTargetElement(target);
  if (!element) return false;
  if (!editorArea.contains(element)) return false;
  if (isUiChrome(element) || isNativeInteractiveElement(element)) return false;
  if (isTableInteractionTarget(element)) return false;

  if (element === editorArea) return true;

  const tiptap = getTiptapRoot(editorArea);
  if (!tiptap) return false;

  if (element === tiptap) return true;

  if (clientX != null && clientY != null) {
    return isBlankEditorPoint(clientX, clientY, tiptap);
  }

  return false;
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
