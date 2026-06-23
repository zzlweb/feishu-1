import type { Editor } from '@tiptap/react';
import { Fragment, type Node as ProseNode } from '@tiptap/pm/model';
import { DOMSerializer } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';

export const OPERABLE_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'taskItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'image',
  'table',
  'highlightBlock',
  'localFileBlock',
  'localColumnsBlock',
  'localDivTableBlock',
  'localSyncBlock',
  'localButtonBlock',
  'localFormulaBlock',
  'localBitableBlock',
  'localEmbedBlock',
]);

export interface EditorBlockRef {
  pos: number;
  from: number;
  to: number;
  node: ProseNode;
}

interface InsertRange {
  from: number;
  to: number;
}

const LIST_BLOCK_TYPES = new Set(['bulletList', 'orderedList', 'taskList']);

function resolveStandaloneBlockInsertPos(editor: Editor, pos: number): number {
  const doc = editor.state.doc;
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(clamped);

  let listDepth = -1;
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (LIST_BLOCK_TYPES.has($pos.node(depth).type.name)) {
      listDepth = depth;
    }
  }

  return listDepth > 0 ? $pos.after(listDepth) : clamped;
}

export function insertStandaloneHorizontalRule(
  editor: Editor,
  options?: { pos?: number; deleteRange?: InsertRange },
): boolean {
  const { state, view } = editor;
  const pos = options?.pos ?? state.selection.from;
  const insertPos = resolveStandaloneBlockInsertPos(editor, pos);
  const horizontalRule = state.schema.nodes.horizontalRule?.create();
  if (!horizontalRule) return false;

  let tr = state.tr;
  if (options?.deleteRange && options.deleteRange.from < options.deleteRange.to) {
    tr = tr.delete(options.deleteRange.from, options.deleteRange.to);
  }

  const mappedInsertPos = tr.mapping.map(insertPos, -1);
  tr = tr.insert(mappedInsertPos, horizontalRule);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function findHorizontalRuleInsideList(doc: ProseNode): { from: number; to: number; insertPos: number } | null {
  let found: { from: number; to: number; insertPos: number } | null = null;
  doc.descendants((node, pos) => {
    if (found || node.type.name !== 'horizontalRule') return false;
    const $pos = doc.resolve(pos);
    let listDepth = -1;
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if (LIST_BLOCK_TYPES.has($pos.node(depth).type.name)) {
        listDepth = depth;
      }
    }
    if (listDepth > 0) {
      found = {
        from: pos,
        to: pos + node.nodeSize,
        insertPos: $pos.after(listDepth),
      };
      return false;
    }
    return true;
  });
  return found;
}

export function normalizeHorizontalRulesOutOfLists(editor: Editor): boolean {
  let tr = editor.state.tr;
  let changed = false;

  for (let guard = 0; guard < 20; guard += 1) {
    const match = findHorizontalRuleInsideList(tr.doc);
    if (!match) break;

    const node = tr.doc.nodeAt(match.from);
    if (!node) break;

    const size = match.to - match.from;
    const insertPos = match.from < match.insertPos ? match.insertPos - size : match.insertPos;
    tr = tr.delete(match.from, match.to).insert(insertPos, node);
    changed = true;
  }

  if (!changed) return false;
  editor.view.dispatch(tr.setMeta('addToHistory', false));
  return true;
}

function getSelectedNode(editor: Editor): EditorBlockRef | null {
  const selection = editor.state.selection;
  if (!(selection instanceof NodeSelection)) return null;
  const node = selection.node;
  if (!OPERABLE_BLOCK_TYPES.has(node.type.name)) return null;
  return {
    pos: selection.from,
    from: selection.from,
    to: selection.to,
    node,
  };
}

export function getCurrentBlock(editor: Editor): EditorBlockRef | null {
  const selectedNode = getSelectedNode(editor);
  if (selectedNode) return selectedNode;

  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 1; depth--) {
    const node = $from.node(depth);
    if (!node.isBlock || !OPERABLE_BLOCK_TYPES.has(node.type.name)) continue;
    const pos = $from.before(depth);
    return {
      pos,
      from: pos,
      to: pos + node.nodeSize,
      node,
    };
  }

  return null;
}

export function getBlockAtPos(editor: Editor, pos: number): EditorBlockRef | null {
  const doc = editor.state.doc;
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(clamped);

  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth);
    if (!node.isBlock || !OPERABLE_BLOCK_TYPES.has(node.type.name)) continue;
    const from = $pos.before(depth);
    return {
      pos: from,
      from,
      to: from + node.nodeSize,
      node,
    };
  }

  const nodeAfter = $pos.nodeAfter;
  if (nodeAfter?.isBlock && OPERABLE_BLOCK_TYPES.has(nodeAfter.type.name)) {
    return {
      pos: clamped,
      from: clamped,
      to: clamped + nodeAfter.nodeSize,
      node: nodeAfter,
    };
  }

  return null;
}

export function expandHeadingBlockToSection(editor: Editor, block: EditorBlockRef): EditorBlockRef {
  if (block.node.type.name !== 'heading') return block;

  const level = Number(block.node.attrs.level || 1);
  let sectionTo = block.to;

  editor.state.doc.forEach((node, offset) => {
    if (offset < block.to) return;
    if (node.type.name === 'heading' && Number(node.attrs.level || 1) <= level) return;
    if (sectionTo !== offset) return;
    sectionTo = offset + node.nodeSize;
  });

  return {
    ...block,
    to: sectionTo,
  };
}

export function selectBlock(editor: Editor, block = getCurrentBlock(editor)): boolean {
  if (!block) return false;
  const { state, view } = editor;
  let selection;

  if (block.node.isAtom || block.node.isLeaf || NodeSelection.isSelectable(block.node)) {
    selection = NodeSelection.create(state.doc, block.pos);
  } else {
    const from = Math.min(block.from + 1, state.doc.content.size);
    const to = Math.max(from, Math.min(block.to - 1, state.doc.content.size));
    selection = TextSelection.create(state.doc, from, to);
  }

  view.dispatch(state.tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
}

export function getInsertBeforePosition(editor: Editor): number {
  return getCurrentBlock(editor)?.from ?? editor.state.selection.from;
}

export function getInsertAfterPosition(editor: Editor): number {
  return getCurrentBlock(editor)?.to ?? editor.state.selection.to;
}

export function insertBefore(editor: Editor, content: Parameters<ReturnType<Editor['chain']>['insertContentAt']>[1]): boolean {
  editor.chain().focus().insertContentAt(getInsertBeforePosition(editor), content).run();
  return true;
}

export function insertAfter(editor: Editor, content: Parameters<ReturnType<Editor['chain']>['insertContentAt']>[1]): boolean {
  editor.chain().focus().insertContentAt(getInsertAfterPosition(editor), content).run();
  return true;
}

export function deleteBlock(editor: Editor): boolean {
  const block = getCurrentBlock(editor);
  if (!block) return false;

  const fallbackParagraph = editor.schema.nodes.paragraph?.createAndFill();
  const isOnlyTopLevelBlock = editor.state.doc.childCount === 1 && block.from === 0;
  const tr =
    isOnlyTopLevelBlock && fallbackParagraph
      ? editor.state.tr.replaceWith(block.from, block.to, fallbackParagraph).scrollIntoView()
      : editor.state.tr.delete(block.from, block.to).scrollIntoView();
  const safePos = Math.max(1, Math.min(block.from, tr.doc.content.size - 1));
  if (tr.doc.content.size > 0) {
    tr.setSelection(TextSelection.near(tr.doc.resolve(safePos), -1));
  }
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

export async function copyBlock(editor: Editor): Promise<boolean> {
  const block = getCurrentBlock(editor);
  if (!block) return false;

  const slice = editor.state.doc.slice(block.from, block.to);
  const serializer = DOMSerializer.fromSchema(editor.schema);
  const fragment = serializer.serializeFragment(slice.content);
  const container = document.createElement('div');
  container.appendChild(fragment);
  const html = container.innerHTML;
  const text = slice.content.textBetween(0, slice.content.size, '\n\n');

  if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return true;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text || html);
    return true;
  }

  selectBlock(editor, block);
  document.execCommand('copy');
  return true;
}

export function moveBlock(editor: Editor, source: EditorBlockRef, target: EditorBlockRef, placement: 'before' | 'after'): boolean {
  if (source.from === target.from && source.to === target.to) return false;
  if (target.from >= source.from && target.to <= source.to) return false;

  const sourceSize = source.to - source.from;
  const insertTarget = placement === 'before' ? target.from : target.to;
  let insertPos = insertTarget;
  if (insertTarget > source.from) {
    insertPos -= sourceSize;
  }
  if (insertPos === source.from || insertPos === source.to) return false;

  const slice = editor.state.doc.slice(source.from, source.to);
  let tr = editor.state.tr.delete(source.from, source.to);
  tr = tr.insert(insertPos, slice.content).scrollIntoView();

  const insertedNode = tr.doc.nodeAt(insertPos);
  if (insertedNode && NodeSelection.isSelectable(insertedNode)) {
    tr = tr.setSelection(NodeSelection.create(tr.doc, insertPos));
  } else if (tr.doc.content.size > 0) {
    const caretPos = Math.max(1, Math.min(insertPos + 1, tr.doc.content.size - 1));
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(caretPos), 1));
  }

  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

export function moveBlockIntoColumns(editor: Editor, source: EditorBlockRef, target: EditorBlockRef): boolean {
  if (source.from === target.from && source.to === target.to) return false;
  if (target.from >= source.from && target.to <= source.to) return false;

  const columnsType = editor.schema.nodes.localColumnsBlock;
  const columnType = editor.schema.nodes.localColumnBlock;
  if (!columnsType || !columnType) return false;

  const sourceContent = editor.state.doc.slice(source.from, source.to).content;
  const targetContent = editor.state.doc.slice(target.from, target.to).content;
  const columnsNode = columnsType.create(
    null,
    Fragment.fromArray([
      columnType.create({ widthRatio: 1 }, targetContent),
      columnType.create({ widthRatio: 1 }, sourceContent),
    ]),
  );

  const sourceSize = source.to - source.from;
  let tr = editor.state.tr;
  let targetFrom = target.from;
  let targetTo = target.to;

  if (source.from < target.from) {
    tr = tr.delete(source.from, source.to);
    targetFrom -= sourceSize;
    targetTo -= sourceSize;
    tr = tr.replaceWith(targetFrom, targetTo, columnsNode);
  } else {
    tr = tr.delete(source.from, source.to);
    tr = tr.replaceWith(targetFrom, targetTo, columnsNode);
  }

  tr = tr.scrollIntoView();
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}
