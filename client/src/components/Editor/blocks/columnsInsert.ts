import type { Editor } from '@tiptap/react';
import type { Fragment } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { createLocalColumnsNode, resolveBlockReplaceRange } from './columnsHelpers';

function focusFirstColumn(tr: any, columnsPos: number) {
  const textPos = Math.min(columnsPos + 2, tr.doc.content.size - 1);
  tr.setSelection(TextSelection.near(tr.doc.resolve(textPos), 1));
}

function getFirstColumnContent(editor: Editor, from: number, to: number): Fragment | null {
  const text = editor.state.doc.textBetween(from, to, '\n', '\0').trim();
  if (!text || /^\/\S*$/.test(text)) return null;
  return editor.state.doc.slice(from, to).content;
}

export function insertFeishuColumns(editor: Editor, columnCount: number): boolean {
  editor.commands.focus();

  return editor.chain().command(({ tr, state, dispatch }) => {
    const { from, to } = resolveBlockReplaceRange(editor);
    const firstColumnContent = getFirstColumnContent(editor, from, to);
    const columnsNode = createLocalColumnsNode(state.schema, columnCount, firstColumnContent);
    if (!columnsNode) return false;

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
