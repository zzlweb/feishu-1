import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { syncImageNodeSelection } from '../media/imageBlockUtils';
import { getTableElementFromHost, resolveTableHostFromElement } from '../tables/tableDom';
import { resolveDraggableBlockPos } from './feishuBlockDrag';

function trySetTextCaret(editor: Editor, el: HTMLElement, offset: number): boolean {
  try {
    const view = editor.view;
    const pos = view.posAtDOM(el, offset);
    const doc = editor.state.doc;
    const size = doc.content.size;
    if (size < 2) return false;
    const clamped = Math.max(1, Math.min(pos, size - 1));
    const $pos = doc.resolve(clamped);
    const sel = TextSelection.near($pos, 1);
    editor.chain().focus().setTextSelection(sel.from).run();
    return true;
  } catch {
    return false;
  }
}

function syncSelectionToTableBlock(editor: Editor, blockEl: HTMLElement): boolean {
  const host = resolveTableHostFromElement(blockEl) ?? blockEl;

  const { selection } = editor.state;
  const $from = selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name !== 'tableCell' && name !== 'tableHeader') continue;
    try {
      const cellPos = $from.before(d);
      const dom = editor.view.nodeDOM(cellPos);
      const cell = dom instanceof HTMLElement ? (dom.closest('td, th') as HTMLElement | null) : null;
      if (cell?.isConnected && host.contains(cell)) {
        const inner =
          cell.querySelector('p, h1, h2, h3, h4, h5, h6, blockquote, pre, li')
          ?? cell;
        if (inner instanceof HTMLElement) return trySetTextCaret(editor, inner, 0);
      }
    } catch {
      break;
    }
  }

  const table = getTableElementFromHost(host);
  const cell =
    (blockEl.closest('td, th') as HTMLElement | null)
    ?? (table?.querySelector('td, th') as HTMLElement | null);
  if (!cell) return false;
  const inner = cell.querySelector('p, h1, h2, h3, h4, h5, h6') ?? cell;
  if (inner instanceof HTMLElement) return trySetTextCaret(editor, inner, 0);
  return false;
}

/** 无选区时选中当前文本块内容，便于对整块应用字体/背景色 */
export function selectTextblockContentRange(editor: Editor): boolean {
  const { selection } = editor.state;
  if (!selection.empty) return true;

  const { $from } = selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (!node.isTextblock) continue;
    const from = $from.start(d);
    const to = $from.end(d);
    if (from >= to) return false;
    editor.chain().focus().setTextSelection({ from, to }).run();
    return true;
  }
  return false;
}

export function prepareEditorForInlineColor(editor: Editor, blockEl: HTMLElement | null): void {
  if (!editor.state.selection.empty) return;
  if (blockEl?.isConnected && editor.view.dom.contains(blockEl)) {
    syncEditorSelectionToAnchoredBlock(editor, blockEl);
  }
  selectTextblockContentRange(editor);
}

/** 解析当前选区所在的 inline 文本块 DOM（表格内返回 cell 中的 p/h，而非 table host） */
export function resolveInlineBlockElementFromEditor(editor: Editor): HTMLElement | null {
  const root = editor.view.dom as HTMLElement;
  const from = editor.state.selection.from;

  try {
    const nodeEl = editor.view.nodeDOM?.(from);
    if (nodeEl instanceof HTMLElement && root.contains(nodeEl)) {
      const inCell = nodeEl.closest('td, th');
      if (inCell) {
        const textBlock = nodeEl.closest('p, h1, h2, h3, h4, h5, h6, blockquote, pre, li') as HTMLElement | null;
        if (textBlock && inCell.contains(textBlock)) return textBlock;
      }
      if (/^(p|h[1-6]|blockquote|pre|li)$/i.test(nodeEl.tagName)) return nodeEl;
    }
  } catch { /* ignore */ }

  const domAt = editor.view.domAtPos(from);
  let n: Node | null = domAt.node;
  if (n.nodeType === Node.TEXT_NODE) n = n.parentElement;
  let el = n as HTMLElement | null;
  while (el && el !== root) {
    const cell = el.closest('td, th');
    if (cell && /^(p|h[1-6]|blockquote|pre|li)$/i.test(el.tagName)) return el;
    if (!cell && /^(p|h[1-6]|blockquote|pre|li)$/i.test(el.tagName)) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * 块柄悬停打开的菜单与 ProseMirror 选区可能不一致（例如指针在块柄上时 target 不是正文）。
 * 在执行块级操作前调用，将选区移到块柄所对准的块内再执行命令。
 */
export function syncEditorSelectionToAnchoredBlock(editor: Editor, blockEl: HTMLElement | null): void {
  if (!blockEl?.isConnected || !editor.view.dom.contains(blockEl)) return;

  const view = editor.view;

  if (resolveTableHostFromElement(blockEl)) {
    syncSelectionToTableBlock(editor, blockEl);
    return;
  }

  if (syncImageNodeSelection(editor, blockEl)) return;

  const bitableEl = blockEl.classList.contains('feishu-bitable-block')
    ? blockEl
    : (blockEl.closest('.feishu-bitable-block') as HTMLElement | null);
  if (bitableEl?.isConnected && view.dom.contains(bitableEl)) {
    try {
      const block = resolveDraggableBlockPos(editor, bitableEl);
      if (block?.node.type.name === 'localBitableBlock' && NodeSelection.isSelectable(block.node)) {
        editor.chain().focus().setNodeSelection(block.pos).run();
        return;
      }
    } catch {
      /* keep selection */
    }
  }

  const selectableAtom = blockEl.closest(
    '.feishu-button-block, .feishu-formula-editor, .feishu-local-card, .feishu-bitable-block, .feishu-div-table, .feishu-file-block, .feishu-sync-block',
  );
  if (selectableAtom instanceof HTMLElement && view.dom.contains(selectableAtom)) {
    try {
      const pos = view.posAtDOM(selectableAtom, 0);
      if (selectableAtom.classList.contains('feishu-sync-block')) {
        const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
          if ($pos.node(depth).type.name !== 'localSyncBlock') continue;
          editor.chain().focus().setNodeSelection($pos.before(depth)).run();
          return;
        }
      }
      const node = editor.state.doc.nodeAt(pos);
      if (node && NodeSelection.isSelectable(node)) {
        editor.chain().focus().setNodeSelection(pos).run();
        return;
      }
    } catch {
      /* keep selection */
    }
  }

  const divider =
    blockEl.classList.contains('feishu-divider')
      ? blockEl
      : (blockEl.querySelector?.('.feishu-divider') as HTMLElement | null);
  if (divider && view.dom.contains(divider)) {
    try {
      const pos = view.posAtDOM(divider, 0);
      editor.chain().focus().setNodeSelection(pos).run();
    } catch {
      /* keep selection */
    }
    return;
  }

  if (blockEl.classList.contains('feishu-code-block')) {
    const pre = blockEl.querySelector('pre');
    if (pre instanceof HTMLElement && trySetTextCaret(editor, pre, 0)) return;
  }

  if (blockEl.classList.contains('feishu-highlight-block')) {
    const content = blockEl.querySelector('.feishu-highlight-content');
    if (content instanceof HTMLElement) {
      const inner = content.querySelector('p, h1, h2, h3, h4, h5, h6') ?? content.firstElementChild;
      if (inner instanceof HTMLElement && trySetTextCaret(editor, inner, 0)) return;
    }
  }

  if (trySetTextCaret(editor, blockEl, 0)) return;
  if (trySetTextCaret(editor, blockEl, 1)) return;

  const directP = blockEl.querySelector?.(':scope > p');
  if (directP instanceof HTMLElement && trySetTextCaret(editor, directP, 0)) return;

  const anyP = blockEl.querySelector?.('p');
  if (anyP instanceof HTMLElement && trySetTextCaret(editor, anyP, 0)) return;
}
