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
  '.block-inline-tools, .feishu-table-chrome, .context-menu, .context-submenu-flyout, .context-add-below-flyout, .slash-menu, .selection-bubble, .editor-page-link-pop, .feishu-box-selection-layer';

function isUiChrome(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(UI_CHROME));
}

function getTiptapRoot(editorArea: HTMLElement): HTMLElement | null {
  return editorArea.querySelector('.tiptap, .ProseMirror');
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

/** 空白/页边区域：可直接按下拖拽开始框选 */
export function canStartBoxSelect(
  target: EventTarget | null,
  editorArea: HTMLElement,
  clientY?: number,
): boolean {
  if (!(target instanceof Element)) return false;
  if (!editorArea.contains(target)) return false;
  if (isUiChrome(target)) return false;

  if (target === editorArea) return true;

  const tiptap = getTiptapRoot(editorArea);
  if (!tiptap) return false;

  // 仅点击编辑器根容器本身（块间空白）
  if (target === tiptap) return true;

  // 最后一个块下方的空白区
  if (clientY != null) {
    const children = tiptap.querySelectorAll(':scope > *');
    if (children.length === 0) return true;
    const last = children[children.length - 1];
    const lastRect = last.getBoundingClientRect();
    if (clientY > lastRect.bottom + 4) return true;
  }

  return false;
}

/** 双击正文任意处进入框选模式（随后可在任意位置拖拽） */
export function canArmBoxSelect(target: EventTarget | null, editorArea: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  if (!editorArea.contains(target)) return false;
  if (isUiChrome(target)) return false;
  return Boolean(target.closest('.tiptap, .ProseMirror') || target === editorArea);
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
