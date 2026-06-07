import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

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
