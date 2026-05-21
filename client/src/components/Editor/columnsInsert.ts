import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { createLocalColumnsNode, resolveBlockReplaceRange } from './columnsHelpers';

function focusFirstColumn(tr: any, columnsPos: number) {
  const textPos = Math.min(columnsPos + 2, tr.doc.content.size - 1);
  tr.setSelection(TextSelection.near(tr.doc.resolve(textPos), 1));
}

export function insertFeishuColumns(editor: Editor, columnCount: number): boolean {
  editor.commands.focus();

  return editor.chain().command(({ tr, state, dispatch }) => {
    const columnsNode = createLocalColumnsNode(state.schema, columnCount);
    if (!columnsNode) return false;

    const { from, to } = resolveBlockReplaceRange(editor);
    tr.replaceWith(from, to, columnsNode);
    focusFirstColumn(tr, tr.mapping.map(from));
    dispatch?.(tr.scrollIntoView());
    return true;
  }).run();
}

export function insertFeishuColumnsAt(editor: Editor, pos: number, columnCount: number): boolean {
  const columnsNode = createLocalColumnsNode(editor.schema, columnCount);
  if (!columnsNode) return false;

  return editor.chain().focus().command(({ tr, dispatch }) => {
    tr.insert(pos, columnsNode);
    focusFirstColumn(tr, pos);
    dispatch?.(tr.scrollIntoView());
    return true;
  }).run();
}
