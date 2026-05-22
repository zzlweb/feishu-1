import type { Editor } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { SLASH_MENU_MAX_HEIGHT } from './slashMenuConfig';

export const MIN_COLUMNS = 1;
/** Slash / 插入菜单分栏选择器最多预选栏数 */
export const MAX_COLUMNS_PICKER = 5;
export const MAX_COLUMNS_BLOCK = 5;
export const FEISHU_COLUMNS_GAP = 14;

/** 分栏间隙中心线位置（与 CSS grid gap 对齐） */
export function computeSplitterLeft(index: number, ratios: number[], gap = FEISHU_COLUMNS_GAP): string {
  const total = ratios.reduce((sum, value) => sum + value, 0) || ratios.length;
  const contentFraction = ratios.slice(0, index + 1).reduce((sum, value) => sum + value, 0) / total;
  const gapCount = Math.max(0, ratios.length - 1);
  const offsetPx = index * gap + gap / 2;
  return `calc((100% - ${gapCount * gap}px) * ${contentFraction} + ${offsetPx}px)`;
}

interface LocalColumnsInsertOptions {
  columnCount?: number;
}

function normalizePickerColumnsCount(columnCount: number): number {
  return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS_PICKER, Math.round(columnCount)));
}

/** 栏数增多时缩小列间距，保证分栏块总宽不超出版心 */
export function resolveColumnsGap(columnCount: number): number {
  if (columnCount >= 8) return 6;
  if (columnCount >= 6) return 8;
  if (columnCount >= 4) return 10;
  return FEISHU_COLUMNS_GAP;
}

/** 栏数增多时缩小栏内水平 padding */
export function resolveColumnPaddingX(columnCount: number): number {
  if (columnCount >= 8) return 6;
  if (columnCount >= 6) return 8;
  if (columnCount >= 4) return 10;
  return 14;
}

function createEmptyColumnNode(schema: Editor['schema'], widthRatio = 1) {
  const columnType = schema.nodes.localColumnBlock;
  const paragraph = schema.nodes.paragraph?.createAndFill();
  return columnType.create(
    { widthRatio },
    paragraph ? Fragment.from(paragraph) : undefined,
  );
}

function createColumnNodeFromContent(schema: Editor['schema'], content: Fragment | null, widthRatio = 1) {
  const columnType = schema.nodes.localColumnBlock;
  if (!columnType) return null;
  if (content && content.childCount > 0) {
    return columnType.create({ widthRatio }, content);
  }
  return createEmptyColumnNode(schema, widthRatio);
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

/** 分栏是否仍为空（仅含空段落），有正文或非段落块时视为已确定内容 */
export function isColumnBlockEmpty(columnNode: ProseMirrorNode): boolean {
  if (columnNode.childCount === 0) return true;
  for (let index = 0; index < columnNode.childCount; index += 1) {
    const child = columnNode.child(index);
    if (child.type.name !== 'paragraph') return false;
    if (child.textContent.trim().length > 0) return false;
  }
  return true;
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
  if (columnsNode.childCount >= MAX_COLUMNS_BLOCK) return;
  const safeAfterIndex = Math.max(0, Math.min(afterIndex, columnsNode.childCount - 1));
  const insertIndex = safeAfterIndex + 1;
  const nextChildren: ProseMirrorNode[] = [];
  const nextCount = columnsNode.childCount + 1;
  const insertedRatio = 100 / nextCount;
  const existingScale = (100 - insertedRatio) / 100;
  const existingRatios = readColumnRatios(columnsNode).map(ratio => ratio * existingScale);

  for (let index = 0; index < columnsNode.childCount; index += 1) {
    const child = ensureColumnHasParagraph(editor.schema, columnsNode.child(index));
    nextChildren.push(child.type.create({ ...child.attrs, widthRatio: existingRatios[index] }, child.content));
    if (index === safeAfterIndex) {
      nextChildren.push(createEmptyColumnNode(editor.schema, insertedRatio));
    }
  }

  const nextColumnsNode = columnsNode.type.create(columnsNode.attrs, Fragment.fromArray(nextChildren));
  replaceColumnsNode(editor, columnsPos, columnsNode, nextColumnsNode, insertIndex);
}

export function unwrapColumnsAt(editor: Editor, getPos: NodeViewProps['getPos']) {
  if (typeof getPos !== 'function') return;
  const columnsPos = getPos();
  const columnsNode = editor.state.doc.nodeAt(columnsPos);
  if (!columnsNode || columnsNode.type.name !== 'localColumnsBlock') return;

  const blocks: ProseMirrorNode[] = [];
  for (let columnIndex = 0; columnIndex < columnsNode.childCount; columnIndex += 1) {
    const column = ensureColumnHasParagraph(editor.schema, columnsNode.child(columnIndex));
    column.content.forEach(child => {
      blocks.push(child);
    });
  }
  if (blocks.length === 0) {
    const paragraph = editor.schema.nodes.paragraph?.createAndFill();
    if (paragraph) blocks.push(paragraph);
  }

  const tr = editor.state.tr.replaceWith(
    columnsPos,
    columnsPos + columnsNode.nodeSize,
    Fragment.fromArray(blocks),
  );
  const selectionPos = Math.min(columnsPos + 1, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(selectionPos), 1));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

export function removeColumnAt(editor: Editor, getPos: NodeViewProps['getPos'], columnIndex: number) {
  if (typeof getPos !== 'function') return;
  const columnsPos = getPos();
  const columnsNode = editor.state.doc.nodeAt(columnsPos);
  if (!columnsNode || columnsNode.type.name !== 'localColumnsBlock') return;
  if (columnsNode.childCount <= 1) {
    unwrapColumnsAt(editor, getPos);
    return;
  }

  const safeRemoveIndex = Math.max(0, Math.min(columnIndex, columnsNode.childCount - 1));
  const remainingCount = columnsNode.childCount - 1;
  const nextChildren: ProseMirrorNode[] = [];

  for (let index = 0; index < columnsNode.childCount; index += 1) {
    if (index === safeRemoveIndex) continue;
    const child = ensureColumnHasParagraph(editor.schema, columnsNode.child(index));
    nextChildren.push(child.type.create({ ...child.attrs, widthRatio: 100 / remainingCount }, child.content));
  }

  const nextColumnsNode = columnsNode.type.create(columnsNode.attrs, Fragment.fromArray(nextChildren));
  replaceColumnsNode(editor, columnsPos, columnsNode, nextColumnsNode, Math.min(safeRemoveIndex, remainingCount - 1));
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
  const minRatio = Math.max(4, Math.min(8, 72 / columnsNode.childCount));
  const minDelta = minRatio - ratios[leftIndex];
  const maxDelta = ratios[leftIndex + 1] - minRatio;
  const appliedDelta = Math.max(minDelta, Math.min(maxDelta, deltaRatio));
  if (Math.abs(appliedDelta) < 0.01) return;
  const nextLeft = ratios[leftIndex] + appliedDelta;
  const nextRight = ratios[leftIndex + 1] - appliedDelta;

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
  const menuH = SLASH_MENU_MAX_HEIGHT;

  const left = anchor.left - gap;

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
  const columnCount = normalizePickerColumnsCount(options.columnCount ?? MIN_COLUMNS);
  return {
    type: 'localColumnsBlock',
    content: Array.from({ length: columnCount }, () => ({
      type: 'localColumnBlock',
      attrs: { widthRatio: 1 },
      content: [{ type: 'paragraph' }],
    })),
  };
}

export function createLocalColumnsNode(
  schema: Editor['schema'],
  columnCount: number,
  firstColumnContent: Fragment | null = null,
): ProseMirrorNode | null {
  const columnsType = schema.nodes.localColumnsBlock;
  if (!columnsType || !schema.nodes.localColumnBlock || !schema.nodes.paragraph) return null;

  const count = normalizePickerColumnsCount(columnCount);
  const columns: ProseMirrorNode[] = [];

  for (let index = 0; index < count; index += 1) {
    const column = index === 0
      ? createColumnNodeFromContent(schema, firstColumnContent, 1)
      : createEmptyColumnNode(schema);
    if (!column) return null;
    columns.push(column);
  }

  return columnsType.create(null, Fragment.fromArray(columns));
}
