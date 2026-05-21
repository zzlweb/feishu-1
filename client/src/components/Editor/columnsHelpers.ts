import type { Editor } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { SLASH_MENU_MAX_HEIGHT, SLASH_MENU_WIDTH } from './slashMenuConfig';

export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 5;

interface LocalColumnsInsertOptions {
  columnCount?: number;
}

function normalizeColumnsCount(columnCount: number): number {
  return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.round(columnCount)));
}

function createEmptyColumnNode(schema: Editor['schema'], widthRatio = 1) {
  const columnType = schema.nodes.localColumnBlock;
  const paragraph = schema.nodes.paragraph?.createAndFill();
  return columnType.create(
    { widthRatio },
    paragraph ? Fragment.from(paragraph) : undefined,
  );
}

function ensureColumnHasParagraph(schema: Editor['schema'], columnNode: ProseMirrorNode): ProseMirrorNode {
  if (columnNode.childCount > 0) return columnNode;
  const paragraph = schema.nodes.paragraph?.createAndFill();
  if (!paragraph) return columnNode;
  return columnNode.type.create(columnNode.attrs, Fragment.from(paragraph));
}

export function readColumnRatios(columnsNode: ProseMirrorNode): number[] {
  const ratios = Array.from({ length: columnsNode.childCount }, (_, index) => {
    const raw = Number(columnsNode.child(index).attrs.widthRatio);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });
  const total = ratios.reduce((sum, value) => sum + value, 0) || ratios.length;
  return ratios.map(value => (value / total) * 100);
}

export function buildGridTemplate(columnsNode: ProseMirrorNode): string {
  return readColumnRatios(columnsNode)
    .map(ratio => `minmax(0, ${ratio.toFixed(4)}fr)`)
    .join(' ');
}

function findColumnPos(columnsPos: number, columnsNode: ProseMirrorNode, columnIndex: number): number {
  let nextPos = columnsPos + 1;
  const safeIndex = Math.max(0, Math.min(columnIndex, columnsNode.childCount - 1));
  for (let index = 0; index < safeIndex; index += 1) {
    nextPos += columnsNode.child(index).nodeSize;
  }
  return nextPos;
}

function setSelectionIntoColumn(tr: any, columnsPos: number, columnsNode: ProseMirrorNode, columnIndex: number) {
  const columnPos = findColumnPos(columnsPos, columnsNode, columnIndex);
  const textPos = Math.min(columnPos + 1, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(textPos)));
}

function replaceColumnsNode(
  editor: Editor,
  oldColumnsPos: number,
  oldColumnsNode: ProseMirrorNode,
  nextColumnsNode: ProseMirrorNode,
  focusColumnIndex: number,
) {
  const tr = editor.state.tr.replaceWith(
    oldColumnsPos,
    oldColumnsPos + oldColumnsNode.nodeSize,
    nextColumnsNode,
  );
  const mappedColumnsPos = tr.mapping.map(oldColumnsPos);
  const mappedColumnsNode = tr.doc.nodeAt(mappedColumnsPos);
  if (mappedColumnsNode) {
    setSelectionIntoColumn(tr, mappedColumnsPos, mappedColumnsNode, focusColumnIndex);
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

export function insertColumnAfterAt(editor: Editor, getPos: NodeViewProps['getPos'], afterIndex: number) {
  if (typeof getPos !== 'function') return;
  const columnsPos = getPos();
  const columnsNode = editor.state.doc.nodeAt(columnsPos);
  if (!columnsNode || columnsNode.type.name !== 'localColumnsBlock') return;
  if (columnsNode.childCount >= MAX_COLUMNS) return;

  const safeAfterIndex = Math.max(0, Math.min(afterIndex, columnsNode.childCount - 1));
  const insertIndex = safeAfterIndex + 1;
  const nextChildren: ProseMirrorNode[] = [];

  for (let index = 0; index < columnsNode.childCount; index += 1) {
    nextChildren.push(ensureColumnHasParagraph(editor.schema, columnsNode.child(index)));
    if (index === safeAfterIndex) {
      nextChildren.push(createEmptyColumnNode(editor.schema));
    }
  }

  const nextColumnsNode = columnsNode.type.create(columnsNode.attrs, Fragment.fromArray(nextChildren));
  replaceColumnsNode(editor, columnsPos, columnsNode, nextColumnsNode, insertIndex);
}

export function resizeColumnsAt(
  editor: Editor,
  getPos: NodeViewProps['getPos'],
  leftIndex: number,
  deltaRatio: number,
) {
  if (typeof getPos !== 'function') return;
  const columnsPos = getPos();
  const columnsNode = editor.state.doc.nodeAt(columnsPos);
  if (!columnsNode || columnsNode.type.name !== 'localColumnsBlock') return;
  if (leftIndex < 0 || leftIndex >= columnsNode.childCount - 1) return;

  const ratios = readColumnRatios(columnsNode);
  const minRatio = 8;
  const nextLeft = Math.max(minRatio, ratios[leftIndex] + deltaRatio);
  const nextRight = Math.max(minRatio, ratios[leftIndex + 1] - deltaRatio);
  if (nextLeft < minRatio || nextRight < minRatio) return;

  const nextChildren = Array.from({ length: columnsNode.childCount }, (_, index) => {
    const child = ensureColumnHasParagraph(editor.schema, columnsNode.child(index));
    const widthRatio = index === leftIndex ? nextLeft : index === leftIndex + 1 ? nextRight : ratios[index];
    return child.type.create({ ...child.attrs, widthRatio }, child.content);
  });

  const nextColumnsNode = columnsNode.type.create(columnsNode.attrs, Fragment.fromArray(nextChildren));
  replaceColumnsNode(editor, columnsPos, columnsNode, nextColumnsNode, leftIndex);
}

export function computeColumnPlusMenuPosition(anchor: DOMRect) {
  const pad = 8;
  const gap = 8;
  const menuW = Math.min(SLASH_MENU_WIDTH, window.innerWidth - pad * 2);
  const menuH = SLASH_MENU_MAX_HEIGHT;
  const leftX = anchor.left - gap - menuW;
  const rightX = anchor.right + gap;
  const fitsLeft = leftX >= pad;
  const fitsRight = rightX + menuW <= window.innerWidth - pad;

  let left = fitsLeft ? leftX : fitsRight ? rightX : Math.max(pad, leftX);
  left = Math.max(pad, Math.min(left, window.innerWidth - menuW - pad));

  let top = anchor.bottom + gap;
  if (top + menuH > window.innerHeight - pad) {
    top = Math.max(pad, anchor.top - gap - Math.min(menuH, window.innerHeight - pad * 2));
  }

  return { top, left };
}

export function isInsideLocalColumnBlock(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'localColumnBlock') return true;
  }
  return false;
}

/** 替换当前块时限制在分栏内部，避免误替换整行分栏容器 */
export function resolveBlockReplaceRange(editor: Editor, anchorPos = editor.state.selection.from) {
  const { state } = editor;
  const safePos = Math.max(1, Math.min(anchorPos, state.doc.content.size - 1));
  const $from = state.doc.resolve(safePos);

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name !== 'localColumnBlock') continue;
    const blockDepth = Math.max(depth + 1, $from.depth);
    return {
      from: $from.before(blockDepth),
      to: $from.after(blockDepth),
    };
  }

  return {
    from: $from.before($from.depth),
    to: $from.after($from.depth),
  };
}

export function focusColumnAtPos(editor: Editor, columnPos: number) {
  try {
    const columnNode = editor.state.doc.nodeAt(columnPos);
    if (!columnNode || columnNode.type.name !== 'localColumnBlock') return;

    if (columnNode.childCount === 0) {
      editor.chain().focus().setTextSelection(Math.min(columnPos + 1, editor.state.doc.content.size)).run();
      return;
    }

    let childPos = columnPos + 1;
    for (let index = 0; index < columnNode.childCount - 1; index += 1) {
      childPos += columnNode.child(index).nodeSize;
    }
    const lastChild = columnNode.child(columnNode.childCount - 1);
    const focusPos = lastChild.isTextblock
      ? childPos + 1
      : Math.max(childPos + 1, childPos + lastChild.nodeSize - 1);
    const selection = TextSelection.near(editor.state.doc.resolve(focusPos), 1);
    editor.chain().focus().setTextSelection(selection.from).run();
  } catch {
    editor.commands.focus();
  }
}

export function focusColumnEditor(editor: Editor, getPos: NodeViewProps['getPos']) {
  if (typeof getPos !== 'function') return;
  const columnPos = getPos();
  if (columnPos == null) return;
  focusColumnAtPos(editor, columnPos);
}

export function buildLocalColumnsInsertContent(options: LocalColumnsInsertOptions = {}) {
  const columnCount = normalizeColumnsCount(options.columnCount ?? MIN_COLUMNS);
  return {
    type: 'localColumnsBlock',
    content: Array.from({ length: columnCount }, () => ({
      type: 'localColumnBlock',
      attrs: { widthRatio: 1 },
      content: [{ type: 'paragraph' }],
    })),
  };
}

export function createLocalColumnsNode(schema: Editor['schema'], columnCount: number): ProseMirrorNode | null {
  const columnsType = schema.nodes.localColumnsBlock;
  const columnType = schema.nodes.localColumnBlock;
  const paragraphType = schema.nodes.paragraph;
  if (!columnsType || !columnType || !paragraphType) return null;

  const count = normalizeColumnsCount(columnCount);
  const columns: ProseMirrorNode[] = [];

  for (let index = 0; index < count; index += 1) {
    const paragraph = paragraphType.createAndFill();
    columns.push(
      columnType.create(
        { widthRatio: 1 },
        paragraph ? Fragment.from(paragraph) : undefined,
      ),
    );
  }

  return columnsType.create(null, Fragment.fromArray(columns));
}
