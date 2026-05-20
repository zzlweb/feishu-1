import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';

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

/** 空块退格：先降级为普通段落，再次退格再与上一行合并（飞书式交互） */
function handleFeishuBackspace(editor: Editor): boolean {
  if (!isAtBlockStart(editor)) return false;

  const { $from } = editor.state.selection;
  const parent = $from.parent;
  const parentType = parent.type.name;

  if (!isCurrentBlockEmpty(editor)) return false;

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
    if (nodeType === 'listItem' || nodeType === 'taskItem') {
      return editor.chain().focus().liftListItem(nodeType).run();
    }
  }

  if (parentType === 'paragraph') {
    if (isFirstBlockInParent(editor)) {
      return true;
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
      Backspace: ({ editor }) => handleFeishuBackspace(editor),
    };
  },
});
