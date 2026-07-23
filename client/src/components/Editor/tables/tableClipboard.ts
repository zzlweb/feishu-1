import type { Editor } from '@tiptap/react';
import { TextSelection, type Selection } from '@tiptap/pm/state';
import { insertTableFromClipboardData } from './tableInsert';
import { matrixFromClipboard, writeCellMatrix } from './feishuTable';


function isEditorSelectionInsideTable(selection: Selection): boolean {
  const anchorDepth = selection.$from.depth;
  for (let depth = anchorDepth; depth > 0; depth -= 1) {
    if (selection.$from.node(depth).type.name === 'table') return true;
  }
  return false;
}

function getDomSelectionCell(view: Editor['view']): HTMLElement | null {
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection?.anchorNode || !view.dom.contains(selection.anchorNode)) return null;
  const anchorElement = selection.anchorNode instanceof Element
    ? selection.anchorNode
    : selection.anchorNode.parentElement;
  return anchorElement?.closest('td, th') as HTMLElement | null;
}

function syncEditorSelectionFromDom(view: Editor['view']) {
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection?.anchorNode || !view.dom.contains(selection.anchorNode) || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const from = view.posAtDOM(range.startContainer, range.startOffset);
  if (typeof from !== 'number') return;
  view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(from))));
}

export function handleTableClipboardPaste(editor: Editor, clipboardData: DataTransfer | null): boolean {
  if (!clipboardData) return false;
  const view = editor.view;
  syncEditorSelectionFromDom(view);
  const targetCell = getDomSelectionCell(view);

  if (targetCell && isEditorSelectionInsideTable(editor.state.selection)) {
    const matrix = matrixFromClipboard(
      clipboardData.getData('text/html'),
      clipboardData.getData('text/plain'),
    );
    return matrix ? writeCellMatrix(editor, matrix, { applySpans: false }) : false;
  }

  return insertTableFromClipboardData(editor, clipboardData, true);
}

