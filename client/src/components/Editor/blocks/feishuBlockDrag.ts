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
  'image',
  'table',
  'localFileBlock',
  'localColumnsBlock',
  'localDivTableBlock',
  'localSyncBlock',
  'localButtonBlock',
  'localFormulaBlock',
  'localBitableBlock',
  'localDashboardChartBlock',
  'localEmbedBlock',
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

function resolvePreferredNodeType(blockEl: HTMLElement): string | null {
  if (blockEl.closest('.feishu-table-host, .tableWrapper')) return 'table';
  if (blockEl.closest('.feishu-file-block')) return 'localFileBlock';
  if (blockEl.closest('.feishu-image-block-wrap')) return 'image';
  if (blockEl.closest('.feishu-bitable-block')) return 'localBitableBlock';
  if (blockEl.closest('.feishu-div-table')) return 'localDivTableBlock';
  if (blockEl.closest('.feishu-sync-block')) return 'localSyncBlock';
  if (blockEl.closest('.feishu-button-block')) return 'localButtonBlock';
  if (blockEl.closest('.feishu-formula-editor')) return 'localFormulaBlock';
  if (blockEl.closest('.feishu-local-card')) return 'localEmbedBlock';
  if (blockEl.closest('.feishu-columns-block')) return 'localColumnsBlock';
  return null;
}

function normalizeDraggableBlockDom(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  const atomBlock = el.closest(
    '.feishu-bitable-block, .feishu-code-block, .feishu-highlight-block, .feishu-divider, .feishu-table-host, .tableWrapper, .feishu-image-block-wrap, .feishu-file-block--image, .feishu-button-block, .feishu-formula-editor, .feishu-div-table, .feishu-local-card, .feishu-file-block, .feishu-sync-block, .feishu-columns-block',
  ) as HTMLElement | null;
  if (atomBlock && root.contains(atomBlock)) return atomBlock;

  const tag = el.tagName.toLowerCase();
  if (/^(p|h[1-6]|blockquote|pre|hr)$/.test(tag)) return el;
  if (tag === 'li') return el;
  return null;
}

function readBlockDomFromNodePos(editor: Editor, blockPos: number, root: HTMLElement): HTMLElement | null {
  try {
    const nodeDom = editor.view.nodeDOM(blockPos);
    if (!(nodeDom instanceof HTMLElement) || !root.contains(nodeDom)) return null;
    return normalizeDraggableBlockDom(nodeDom, root);
  } catch {
    return null;
  }
}

export function resolveBlockDomAtDocPos(editor: Editor, pos: number): HTMLElement | null {
  const root = editor.view.dom as HTMLElement;
  const clamped = Math.max(0, Math.min(pos, editor.state.doc.content.size));

  try {
    const $pos = editor.state.doc.resolve(clamped);
    for (let depth = $pos.depth; depth >= 1; depth -= 1) {
      const node = $pos.node(depth);
      if (!DRAGGABLE_BLOCK_TYPES.has(node.type.name)) continue;
      if (depth > 1 && $pos.node(depth - 1).type.name !== 'doc') continue;
      const mapped = readBlockDomFromNodePos(editor, $pos.before(depth), root);
      if (mapped) return mapped;
    }
  } catch {
    /* fall through to domAtPos */
  }

  try {
    const domAt = editor.view.domAtPos(clamped);
    let el: HTMLElement | null = domAt.node.nodeType === Node.TEXT_NODE
      ? (domAt.node as Text).parentElement
      : domAt.node as HTMLElement;
    while (el && el !== root) {
      const mapped = normalizeDraggableBlockDom(el, root);
      if (mapped) return mapped;
      el = el.parentElement;
    }
  } catch {
    /* ignore invalid positions */
  }

  return null;
}

/** 左侧块柄拖拽时 X 常落在版心外，需把探测点收进正文列再解析目标块 */
export function probeCoordsInEditorContent(
  editor: Editor,
  clientX: number,
  clientY: number,
): { left: number; top: number } {
  const root = editor.view.dom as HTMLElement;
  const rect = root.getBoundingClientRect();
  const edgePad = 12;
  return {
    left: Math.min(Math.max(clientX, rect.left + edgePad), Math.max(rect.left + edgePad, rect.right - edgePad)),
    top: clientY,
  };
}

export function resolveBlockDomAtPoint(editor: Editor, clientX: number, clientY: number): HTMLElement | null {
  const probe = probeCoordsInEditorContent(editor, clientX, clientY);
  const coords = editor.view.posAtCoords({ left: probe.left, top: probe.top });
  if (!coords) return null;
  return resolveBlockDomAtDocPos(editor, coords.pos);
}

export function resolveDraggableBlockPos(editor: Editor, blockEl: HTMLElement | null): BlockPos | null {
  if (!blockEl?.isConnected || !editor.view.dom.contains(blockEl)) return null;

  const preferredType = resolvePreferredNodeType(blockEl);
  const candidates = [0, 1];
  for (const offset of candidates) {
    try {
      const rawPos = editor.view.posAtDOM(blockEl, offset);
      const direct = readDirectNode(editor, rawPos);
      if (direct && (!preferredType || direct.node.type.name === preferredType)) return direct;

      const $pos = editor.state.doc.resolve(Math.max(0, Math.min(rawPos, editor.state.doc.content.size)));
      for (let depth = $pos.depth; depth >= 1; depth -= 1) {
        const node = $pos.node(depth);
        if (preferredType && node.type.name !== preferredType) continue;
        if (!DRAGGABLE_BLOCK_TYPES.has(node.type.name)) continue;
        return {
          pos: $pos.before(depth),
          node,
          depth,
          parentPos: depth > 1 ? $pos.before(depth - 1) : 0,
        };
      }
      if (direct) return direct;
    } catch {
      /* try the next DOM offset */
    }
  }

  return null;
}

function computeMoveInsertPos(
  source: BlockPos,
  target: BlockPos,
  placement: 'before' | 'after',
): number | null {
  if (source.pos === target.pos) return null;

  const sourceFrom = source.pos;
  const sourceTo = source.pos + source.node.nodeSize;
  if (target.pos >= sourceFrom && target.pos < sourceTo) return null;

  let insertPos = target.pos;
  if (placement === 'after') insertPos += target.node.nodeSize;
  if (source.pos < target.pos) insertPos -= source.node.nodeSize;
  if (insertPos === source.pos) return null;
  return insertPos;
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
  if (source.parentPos !== target.parentPos) return false;

  let insertPos = computeMoveInsertPos(source, target, placement);
  if (insertPos == null) {
    insertPos = computeMoveInsertPos(source, target, placement === 'before' ? 'after' : 'before');
  }
  if (insertPos == null) return false;

  const sourceFrom = source.pos;
  const sourceTo = source.pos + source.node.nodeSize;
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
