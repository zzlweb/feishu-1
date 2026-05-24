import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

const DRAGGABLE_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'taskItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'highlightBlock',
]);

interface BlockPos {
  pos: number;
  node: ProseMirrorNode;
  depth: number;
  parentPos: number;
}

function readDirectNode(editor: Editor, pos: number): BlockPos | null {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || !DRAGGABLE_BLOCK_TYPES.has(node.type.name)) return null;
  const $pos = editor.state.doc.resolve(pos);
  return {
    pos,
    node,
    depth: $pos.depth + 1,
    parentPos: $pos.depth > 0 ? $pos.before($pos.depth) : 0,
  };
}

export function resolveDraggableBlockPos(editor: Editor, blockEl: HTMLElement | null): BlockPos | null {
  if (!blockEl?.isConnected || !editor.view.dom.contains(blockEl)) return null;

  const candidates = [0, 1];
  for (const offset of candidates) {
    try {
      const rawPos = editor.view.posAtDOM(blockEl, offset);
      const direct = readDirectNode(editor, rawPos);
      if (direct) return direct;

      const $pos = editor.state.doc.resolve(Math.max(0, Math.min(rawPos, editor.state.doc.content.size)));
      for (let depth = $pos.depth; depth >= 1; depth -= 1) {
        const node = $pos.node(depth);
        if (!DRAGGABLE_BLOCK_TYPES.has(node.type.name)) continue;
        return {
          pos: $pos.before(depth),
          node,
          depth,
          parentPos: $pos.before(depth - 1),
        };
      }
    } catch {
      /* try the next DOM offset */
    }
  }

  return null;
}

export function moveDraggableBlock(
  editor: Editor,
  sourceEl: HTMLElement | null,
  targetEl: HTMLElement | null,
  placement: 'before' | 'after',
): boolean {
  const source = resolveDraggableBlockPos(editor, sourceEl);
  const target = resolveDraggableBlockPos(editor, targetEl);
  if (!source || !target) return false;
  if (source.pos === target.pos) return false;
  if (source.parentPos !== target.parentPos) return false;

  const sourceFrom = source.pos;
  const sourceTo = source.pos + source.node.nodeSize;
  if (target.pos >= sourceFrom && target.pos < sourceTo) return false;

  let insertPos = target.pos;
  if (placement === 'after') insertPos += target.node.nodeSize;
  if (source.pos < target.pos) insertPos -= source.node.nodeSize;

  const tr = editor.state.tr.delete(sourceFrom, sourceTo).insert(insertPos, source.node);
  try {
    if (NodeSelection.isSelectable(source.node)) {
      tr.setSelection(NodeSelection.create(tr.doc, insertPos));
    } else {
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertPos + 1, tr.doc.content.size)), 1));
    }
  } catch {
    /* keep mapped selection */
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}
