import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';

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
  const table = blockEl.classList.contains('tableWrapper')
    ? blockEl.querySelector('table')
    : blockEl.closest('.tableWrapper')?.querySelector('table');
  const cell =
    (blockEl.closest('td, th') as HTMLElement | null)
    ?? (table?.querySelector('td, th') as HTMLElement | null);
  if (!cell) return false;
  const inner = cell.querySelector('p') ?? cell;
  if (inner instanceof HTMLElement) return trySetTextCaret(editor, inner, 0);
  return false;
}

/**
 * 块柄悬停打开的菜单与 ProseMirror 选区可能不一致（例如指针在块柄上时 target 不是正文）。
 * 在执行块级操作前调用，将选区移到块柄所对准的块内再执行命令。
 */
export function syncEditorSelectionToAnchoredBlock(editor: Editor, blockEl: HTMLElement | null): void {
  if (!blockEl?.isConnected || !editor.view.dom.contains(blockEl)) return;

  const view = editor.view;

  if (blockEl.classList.contains('tableWrapper') || blockEl.closest('.tableWrapper')) {
    syncSelectionToTableBlock(editor, blockEl);
    return;
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
