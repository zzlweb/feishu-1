import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { boxSelectionStore } from './boxSelectionModel';
import { OPERABLE_BLOCK_TYPES } from './blockOperations';

function isAtBlockStart(editor: Editor): boolean {
  const { $from, empty } = editor.state.selection;
  return empty && $from.parentOffset === 0;
}

function isCurrentBlockEmpty(editor: Editor): boolean {
  return editor.state.selection.$from.parent.textContent.length === 0;
}

function isFirstBlockInParent(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  return $from.index($from.depth - 1) === 0;
}

function deleteCurrentEmptyParagraphBlock(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== 'paragraph') return false;
  if (!isCurrentBlockEmpty(editor)) return false;

  const depth = $from.depth;
  if (depth !== 1) return false;
  if (editor.state.doc.childCount <= 1) return false;
  return deleteAncestorBlock(editor, depth);
}

function deleteAncestorBlock(editor: Editor, depth: number): boolean {
  const { $from } = editor.state.selection;
  const node = $from.node(depth);
  const isListItem = node.type.name === 'listItem' || node.type.name === 'taskItem';
  const parent = depth > 0 ? $from.node(depth - 1) : null;
  const targetDepth = isListItem && parent?.childCount === 1 ? depth - 1 : depth;
  const from = $from.before(targetDepth);
  const to = from + $from.node(targetDepth).nodeSize;
  const fallback = editor.schema.nodes.paragraph?.createAndFill();
  const replacesOnlyTopLevelBlock = targetDepth === 1 && editor.state.doc.childCount === 1;

  let tr = replacesOnlyTopLevelBlock && fallback
    ? editor.state.tr.replaceWith(from, to, fallback)
    : editor.state.tr.delete(from, to);
  if (!tr.docChanged) return false;

  if (tr.doc.content.size > 0) {
    const cursorPos = Math.max(1, Math.min(from + 1, tr.doc.content.size - 1));
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos), -1));
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

function deleteEmptyContainerBlock(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth - 1; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (!node.isBlock || !OPERABLE_BLOCK_TYPES.has(node.type.name)) continue;
    if (node.isTextblock) continue;
    if (node.type.name === 'listItem' || node.type.name === 'taskItem') continue;
    if (node.textContent.length > 0) return false;
    return deleteAncestorBlock(editor, depth);
  }
  return false;
}

function deleteCurrentEmptyNestedBlock(editor: Editor): boolean {
  if (boxSelectionStore?.isActive()) return false;
  if (!isAtBlockStart(editor) || !isCurrentBlockEmpty(editor)) return false;

  const { $from } = editor.state.selection;
  if (deleteEmptyContainerBlock(editor)) return true;
  if (deleteCurrentEmptyParagraphBlock(editor)) return true;

  for (let d = $from.depth; d > 0; d--) {
    const nodeType = $from.node(d).type.name;
    if (nodeType === 'taskItem' || nodeType === 'listItem') {
      return deleteAncestorBlock(editor, d);
    }
  }

  return false;
}

/** 空块退格：先降级为普通段落，再次退格再与上一行合并（飞书式交互） */
function handleFeishuBackspace(editor: Editor): boolean {
  if (boxSelectionStore?.isActive()) return false;

  if (!isAtBlockStart(editor)) return false;

  const { $from } = editor.state.selection;
  const parent = $from.parent;
  const parentType = parent.type.name;

  if (!isCurrentBlockEmpty(editor)) return false;

  if (deleteEmptyContainerBlock(editor)) return true;

  if (parentType === 'heading') {
    return editor.chain().focus().setParagraph().run();
  }

  if (parentType === 'blockquote') {
    return editor.chain().focus().setParagraph().run();
  }

  if (parentType === 'codeBlock') {
    return editor.chain().focus().setParagraph().run();
  }

  for (let d = $from.depth; d > 0; d--) {
    const nodeType = $from.node(d).type.name;
    if (nodeType === 'taskItem') {
      return deleteAncestorBlock(editor, d);
    }
    if (nodeType === 'listItem') {
      return deleteAncestorBlock(editor, d);
    }
  }

  if (parentType === 'paragraph') {
    if (isFirstBlockInParent(editor)) {
      return deleteCurrentEmptyParagraphBlock(editor) || true;
    }
    return editor.chain().focus().joinBackward().run();
  }

  return false;
}

export const FeishuBlockBackspace = Extension.create({
  name: 'feishuBlockBackspace',
  priority: 200,

  addKeyboardShortcuts() {
    return {
      Delete: ({ editor }) => deleteCurrentEmptyNestedBlock(editor),
      Backspace: ({ editor }) => handleFeishuBackspace(editor),
    };
  },
});
