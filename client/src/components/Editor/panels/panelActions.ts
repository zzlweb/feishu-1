import type { Editor } from '@tiptap/react';
import { CellSelection } from '@tiptap/pm/tables';
import {
  deleteActiveTableColumn,
  deleteActiveTableRow,
  distributeActiveTableColumns,
  getActiveTableContext,
  insertTableColumnRelative,
  insertTableRowRelative,
} from '../tables/tableInsert';

export type BlockStyleKind =
  | 'paragraph'
  | 'orderedList'
  | 'bulletList'
  | 'taskList'
  | 'codeBlock'
  | 'blockquote'
  | 'highlightBlock';

export function setHeadingLevel(editor: Editor, level: number) {
  if (level === 0) {
    editor.chain().focus().setParagraph().run();
    return;
  }
  editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
}

export function toggleBlockStyle(editor: Editor, type: BlockStyleKind) {
  switch (type) {
    case 'paragraph':
      if (editor.isActive('highlightBlock')) {
        editor.chain().focus().lift('highlightBlock').setParagraph().run();
        return;
      }
      editor.chain().focus().setParagraph().run();
      return;
    case 'orderedList':
      editor.chain().focus().toggleOrderedList().run();
      return;
    case 'bulletList':
      editor.chain().focus().toggleBulletList().run();
      return;
    case 'taskList':
      editor.chain().focus().toggleTaskList().run();
      return;
    case 'codeBlock':
      editor.chain().focus().toggleCodeBlock().run();
      return;
    case 'blockquote':
      editor.chain().focus().toggleBlockquote().run();
      return;
    case 'highlightBlock':
      editor
        .chain()
        .focus()
        .toggleWrap('highlightBlock', { bgColor: '#fff0d9', borderColor: '#ffb057' })
        .run();
      return;
  }
}

export function setTextAlignment(editor: Editor, value: 'left' | 'center' | 'right') {
  editor.chain().focus().setTextAlign(value).run();
}

export function increaseIndent(editor: Editor, run: (editor: Editor) => void) {
  run(editor);
}

export function decreaseIndent(editor: Editor, run: (editor: Editor) => void) {
  run(editor);
}

export function copySelectedPlainText(editor: Editor) {
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, '\n');
  void navigator.clipboard?.writeText(text);
}

export function isTableSelection(editor: Editor) {
  return editor.isActive('table') || editor.state.selection instanceof CellSelection;
}

export function toggleTableHeaderColumn(editor: Editor) {
  editor.chain().focus().toggleHeaderColumn().run();
}

export function toggleTableHeaderRow(editor: Editor) {
  editor.chain().focus().toggleHeaderRow().run();
}

export function insertTableColumn(editor: Editor, side: 'before' | 'after') {
  insertTableColumnRelative(editor, side);
}

export function insertTableRow(editor: Editor, side: 'before' | 'after') {
  insertTableRowRelative(editor, side);
}

export function mergeOrSplitSelectedCells(editor: Editor) {
  if (editor.can().mergeCells()) {
    editor.chain().focus().mergeCells().run();
    return;
  }
  if (editor.can().splitCell()) {
    editor.chain().focus().splitCell().run();
  }
}

export function setSelectedTableCellBackground(editor: Editor, color: string | null) {
  editor.chain().focus().setCellAttribute('backgroundColor', color).run();
}

export function removeSelectedTableColumn(editor: Editor) {
  deleteActiveTableColumn(editor);
}

export function removeSelectedTableRow(editor: Editor) {
  deleteActiveTableRow(editor);
}

export function removeActiveTable(editor: Editor) {
  const ctx = getActiveTableContext(editor);
  if (ctx) {
    editor.chain().focus().deleteTable().run();
    return;
  }
  editor.chain().focus().deleteSelection().run();
}

export function distributeSelectedTableColumns(editor: Editor) {
  distributeActiveTableColumns(editor);
}
