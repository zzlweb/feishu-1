import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

export function findEmptyParagraphNearPoint(
  root: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLParagraphElement | null {
  const rootRect = root.getBoundingClientRect();
  if (clientX < rootRect.left || clientX > rootRect.right) return null;

  let best: { paragraph: HTMLParagraphElement; distance: number } | null = null;
  const paragraphs = Array.from(root.querySelectorAll(':scope > p'));
  for (const paragraph of paragraphs) {
    if (!(paragraph instanceof HTMLParagraphElement)) continue;
    const text = (paragraph.textContent ?? '').replace(/\u200b/g, '').trim();
    if (text) continue;
    const rect = paragraph.getBoundingClientRect();
    const expandedTop = rect.top - 18;
    const expandedBottom = rect.bottom + 120;
    if (clientY < expandedTop || clientY > expandedBottom) continue;
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(clientY - center);
    if (!best || distance < best.distance) best = { paragraph, distance };
  }
  return best?.paragraph ?? null;
}

function findLastContentBlockElement(tiptap: HTMLElement): HTMLElement | null {
  const children = Array.from(tiptap.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (child.tagName === 'P') {
      const text = (child.textContent ?? '').replace(/\u200b/g, '').trim();
      if (!text) continue;
    }
    return child;
  }
  return children.length > 0 ? children[children.length - 1] : null;
}

function focusParagraphDom(editor: Editor, paragraph: HTMLElement): void {
  try {
    const pos = editor.view.posAtDOM(paragraph, 0);
    const textPos = Math.max(1, Math.min(pos + 1, editor.state.doc.content.size - 1));
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, textPos)).scrollIntoView(),
    );
    editor.view.focus();
  } catch {
    focusTrailingParagraph(editor);
  }
}

function getTopLevelChildren(tiptap: HTMLElement): HTMLElement[] {
  return Array.from(tiptap.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
}

function normalizeTopLevelPos(editor: Editor, pos: number): number {
  const docSize = editor.state.doc.content.size;
  const clamped = Math.max(0, Math.min(pos, docSize));
  try {
    const resolved = editor.state.doc.resolve(clamped);
    return resolved.depth > 0 ? resolved.before(1) : clamped;
  } catch {
    return clamped;
  }
}

function resolveBlankAreaInsertPos(editor: Editor, clientY: number): number | null {
  const tiptap = editor.view.dom;
  if (!(tiptap instanceof HTMLElement)) return null;

  const children = getTopLevelChildren(tiptap);
  if (children.length === 0) return 0;

  for (const child of children) {
    const rect = child.getBoundingClientRect();
    if (clientY < rect.top - 4) {
      return normalizeTopLevelPos(editor, editor.view.posAtDOM(child, 0));
    }
    if (clientY <= rect.bottom + 4) return null;
  }

  return editor.state.doc.content.size;
}

function insertEmptyParagraphAt(editor: Editor, pos: number): boolean {
  const paragraph = editor.schema.nodes.paragraph?.createAndFill();
  if (!paragraph) return false;

  const clamped = Math.max(0, Math.min(pos, editor.state.doc.content.size));
  let tr = editor.state.tr.insert(clamped, paragraph);
  const selectionPos = Math.max(1, Math.min(clamped + 1, tr.doc.content.size - 1));
  tr = tr.setSelection(TextSelection.create(tr.doc, selectionPos)).scrollIntoView();
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

/** 点击正文空白区：聚焦已有空行，或在文末补一行空白段落后聚焦。 */
export function handleEditorBlankAreaClick(editor: Editor, clientX: number, clientY: number): boolean {
  if (!editor.isEditable) return false;
  const tiptap = editor.view.dom;
  if (!(tiptap instanceof HTMLElement)) return false;

  const emptyParagraphAtPoint = findEmptyParagraphNearPoint(tiptap, clientX, clientY);
  if (emptyParagraphAtPoint) {
    focusParagraphDom(editor, emptyParagraphAtPoint);
    return true;
  }

  const insertPos = resolveBlankAreaInsertPos(editor, clientY);
  if (insertPos != null) {
    return insertEmptyParagraphAt(editor, insertPos);
  }

  const lastContentBlock = findLastContentBlockElement(tiptap);
  const lastContentRect = lastContentBlock?.getBoundingClientRect();
  const clickedBelowLastContent = Boolean(lastContentRect && clientY > lastContentRect.bottom + 8);

  if (clickedBelowLastContent) {
    ensureTrailingParagraph(editor);
    focusTrailingParagraph(editor);
    return true;
  }

  const posAtClick = editor.view.posAtCoords({ left: clientX, top: clientY });
  if (posAtClick) {
    const resolved = editor.state.doc.resolve(posAtClick.pos);
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.near(resolved)).scrollIntoView(),
    );
    editor.view.focus();
    return true;
  }

  return false;
}

/** 双击块间空白区：在命中的上下块之间插入一行空白段落。 */
export function handleEditorBlankAreaDoubleClick(editor: Editor, clientX: number, clientY: number): boolean {
  if (!editor.isEditable) return false;
  const tiptap = editor.view.dom;
  if (!(tiptap instanceof HTMLElement)) return false;

  const emptyParagraphAtPoint = findEmptyParagraphNearPoint(tiptap, clientX, clientY);
  if (emptyParagraphAtPoint) {
    focusParagraphDom(editor, emptyParagraphAtPoint);
    return true;
  }

  const insertPos = resolveBlankAreaInsertPos(editor, clientY);
  if (insertPos == null) return false;
  return insertEmptyParagraphAt(editor, insertPos);
}

export function needsTrailingParagraph(doc: Editor['state']['doc']) {
  const last = doc.lastChild;
  if (!last) return true;
  return last.type.name !== 'paragraph';
}

export function ensureTrailingParagraph(editor: Editor) {
  if (!needsTrailingParagraph(editor.state.doc)) return false;
  const paragraph = editor.schema.nodes.paragraph?.createAndFill();
  if (!paragraph) return false;
  const end = editor.state.doc.content.size;
  const tr = editor.state.tr.insert(end, paragraph);
  editor.view.dispatch(tr.setMeta('addToHistory', false));
  return true;
}

export function focusTrailingParagraph(editor: Editor) {
  ensureTrailingParagraph(editor);
  const end = editor.state.doc.content.size;
  if (end <= 0) return false;
  const pos = Math.max(1, end - 1);
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)).scrollIntoView(),
  );
  editor.view.focus();
  return true;
}

export const FeishuTrailingParagraph = Extension.create({
  name: 'feishuTrailingParagraph',
  priority: 1000,

  onCreate() {
    ensureTrailingParagraph(this.editor);
  },

  onUpdate() {
    ensureTrailingParagraph(this.editor);
  },
});
