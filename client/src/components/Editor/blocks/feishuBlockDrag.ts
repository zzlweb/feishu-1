import { NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { MAX_COLUMNS_BLOCK, readColumnRatios } from './columnsHelpers';
import { moveBlockIntoColumns, type EditorBlockRef } from './blockOperations';
import {
  IMAGE_GRID_SIDE_EDGE_HIT_PX,
  insertImagesAtIndex,
  moveImageWithinGrid,
  removeImageAtIndex,
  resolveGridColumnCount,
  writeImageGridAtPos,
} from './imageGridDrag';

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
  'localImageGridBlock',
  'localDivTableBlock',
  'localSyncBlock',
  'localButtonBlock',
  'localFormulaBlock',
  'localBitableBlock',
  'localDashboardChartBlock',
  'localEmbedBlock',
]);

/** 块拖放落点：上下重排，或图片左右并排排版 */
export type BlockDragPlacement = 'before' | 'after' | 'left' | 'right';

export type ImageGridCellData = {
  src: string;
  alt?: string;
  align?: 'left' | 'center' | 'right';
  caption?: string;
  captionVisible?: boolean;
  originalSrc?: string;
};

function parseNodeImagesAttr(raw: unknown): ImageGridCellData[] {
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const src = String((item as ImageGridCellData).src || '').trim();
        if (!src) return null;
        const data = item as ImageGridCellData;
        const alt = String(data.alt || '').trim();
        return {
          src,
          ...(alt ? { alt } : {}),
          ...(data.align ? { align: data.align } : {}),
          ...(data.caption ? { caption: data.caption } : {}),
          ...(data.captionVisible ? { captionVisible: true } : {}),
          ...(data.originalSrc ? { originalSrc: data.originalSrc } : {}),
        };
      })
      .filter((item): item is ImageGridCellData => Boolean(item));
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseNodeImagesAttr(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function stringifyGridImagesAttr(images: ImageGridCellData[]): string {
  return JSON.stringify(images.map(image => ({
    src: image.src,
    ...(image.alt ? { alt: image.alt } : {}),
    ...(image.align ? { align: image.align } : {}),
    ...(image.caption ? { caption: image.caption } : {}),
    ...(image.captionVisible ? { captionVisible: true } : {}),
    ...(image.originalSrc ? { originalSrc: image.originalSrc } : {}),
  })));
}

export function readImageLayoutCells(node: ProseMirrorNode): ImageGridCellData[] | null {
  if (node.type.name === 'localImageGridBlock') {
    const images = parseNodeImagesAttr(node.attrs.images);
    return images.length ? images : null;
  }
  if (node.type.name === 'image') {
    const src = String(node.attrs.src || '').trim();
    if (!src) return null;
    const alt = String(node.attrs.alt || node.attrs.title || '').trim();
    return [{
      src,
      ...(alt ? { alt } : {}),
      align: node.attrs.align,
      caption: node.attrs.caption,
      captionVisible: node.attrs.captionVisible,
      originalSrc: node.attrs.originalSrc,
    }];
  }
  if (node.type.name === 'localFileBlock' && String(node.attrs.mediaKind || '') === 'image') {
    const src = String(node.attrs.url || node.attrs.previewUrl || node.attrs.localObjectUrl || '').trim();
    if (!src) return null;
    const alt = String(node.attrs.name || node.attrs.alt || '').trim();
    return [{
      src,
      ...(alt ? { alt } : {}),
      align: node.attrs.align,
      caption: node.attrs.caption,
      captionVisible: node.attrs.captionVisible,
      originalSrc: node.attrs.originalUrl,
    }];
  }
  return null;
}

export function isImageLayoutCapableNode(node: ProseMirrorNode): boolean {
  return Boolean(readImageLayoutCells(node)?.length);
}

export function resolveImageLayoutPlacement(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  canSideLayout: boolean,
): BlockDragPlacement {
  const relY = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
  if (canSideLayout) {
    if (clientX - rect.left <= IMAGE_GRID_SIDE_EDGE_HIT_PX) return 'left';
    if (rect.right - clientX <= IMAGE_GRID_SIDE_EDGE_HIT_PX) return 'right';
  }
  return relY < 0.5 ? 'before' : 'after';
}

function toEditorBlockRef(block: BlockPos): EditorBlockRef {
  return {
    pos: block.pos,
    from: block.pos,
    to: block.pos + block.node.nodeSize,
    node: block.node,
  };
}

function findColumnsContext(doc: ProseMirrorNode, pos: number): {
  columnsPos: number;
  columnsNode: ProseMirrorNode;
  columnIndex: number;
  columnPos: number;
} | null {
  try {
    const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
    let columnDepth = -1;
    let columnsDepth = -1;
    for (let depth = $pos.depth; depth >= 1; depth -= 1) {
      const name = $pos.node(depth).type.name;
      if (columnDepth < 0 && name === 'localColumnBlock') columnDepth = depth;
      if (columnsDepth < 0 && name === 'localColumnsBlock') columnsDepth = depth;
    }
    if (columnDepth < 0 || columnsDepth < 0) return null;
    const columnsPos = $pos.before(columnsDepth);
    const columnsNode = $pos.node(columnsDepth);
    const columnPos = $pos.before(columnDepth);
    let cursor = columnsPos + 1;
    let columnIndex = 0;
    for (let index = 0; index < columnsNode.childCount; index += 1) {
      if (cursor === columnPos) {
        columnIndex = index;
        break;
      }
      cursor += columnsNode.child(index).nodeSize;
    }
    return { columnsPos, columnsNode, columnIndex, columnPos };
  } catch {
    return null;
  }
}

function createColumnFromBlock(schema: Editor['schema'], node: ProseMirrorNode, widthRatio: number) {
  const columnType = schema.nodes.localColumnBlock;
  if (!columnType) return null;
  return columnType.create({ widthRatio }, Fragment.from(node));
}

/** 飞书：已有分栏时，拖到某栏左右侧 → 新增一栏 */
function moveSourceAsAdjacentColumn(
  editor: Editor,
  source: BlockPos,
  target: BlockPos,
  side: 'left' | 'right',
): boolean {
  const context = findColumnsContext(editor.state.doc, target.pos);
  if (!context) return false;
  if (context.columnsNode.childCount >= MAX_COLUMNS_BLOCK) return false;
  if (source.node.type.name === 'localColumnsBlock') return false;

  // 源块已在同一分栏容器内时，避免复杂自删映射，改走同级合并
  const sourceContext = findColumnsContext(editor.state.doc, source.pos);
  if (sourceContext && sourceContext.columnsPos === context.columnsPos) return false;

  const sourceFrom = source.pos;
  const sourceTo = source.pos + source.node.nodeSize;
  const sourceNode = source.node;
  const sourceSize = sourceTo - sourceFrom;

  let tr = editor.state.tr.delete(sourceFrom, sourceTo);
  let columnsPos = context.columnsPos;
  if (sourceFrom < columnsPos) columnsPos -= sourceSize;

  const columnsNode = tr.doc.nodeAt(columnsPos);
  if (!columnsNode || columnsNode.type.name !== 'localColumnsBlock') return false;
  if (columnsNode.childCount >= MAX_COLUMNS_BLOCK) return false;

  const insertIndex = side === 'left' ? context.columnIndex : context.columnIndex + 1;
  const nextCount = columnsNode.childCount + 1;
  const insertedRatio = 100 / nextCount;
  const existingScale = (100 - insertedRatio) / 100;
  const existingRatios = readColumnRatios(columnsNode).map(ratio => ratio * existingScale);
  const nextChildren: ProseMirrorNode[] = [];

  for (let index = 0; index < columnsNode.childCount; index += 1) {
    if (index === insertIndex) {
      const inserted = createColumnFromBlock(editor.schema, sourceNode, insertedRatio);
      if (!inserted) return false;
      nextChildren.push(inserted);
    }
    const child = columnsNode.child(index);
    nextChildren.push(child.type.create({ ...child.attrs, widthRatio: existingRatios[index] }, child.content));
  }
  if (insertIndex >= columnsNode.childCount) {
    const inserted = createColumnFromBlock(editor.schema, sourceNode, insertedRatio);
    if (!inserted) return false;
    nextChildren.push(inserted);
  }

  const nextColumns = columnsNode.type.create(columnsNode.attrs, Fragment.fromArray(nextChildren));
  tr = tr.replaceWith(columnsPos, columnsPos + columnsNode.nodeSize, nextColumns);
  try {
    const inserted = tr.doc.nodeAt(columnsPos);
    if (inserted && NodeSelection.isSelectable(inserted)) {
      tr = tr.setSelection(NodeSelection.create(tr.doc, columnsPos));
    }
  } catch {
    /* keep mapped selection */
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/**
 * 飞书分栏拖拽：
 * - 同级左右拖 → 新建两栏
 * - 拖到已有分栏某栏左右 → 加栏
 * - 纯图左右拖仍走图片排版（由调用方分流）
 */
export function moveBlocksIntoColumnsLayout(
  editor: Editor,
  sourceEl: HTMLElement | null,
  targetEl: HTMLElement | null,
  side: 'left' | 'right',
): boolean {
  const source = resolveDraggableBlockPos(editor, sourceEl);
  const target = resolveDraggableBlockPos(editor, targetEl);
  if (!source || !target) return false;
  if (source.pos === target.pos) return false;

  if (findColumnsContext(editor.state.doc, target.pos) && !findColumnsContext(editor.state.doc, source.pos)) {
    if (moveSourceAsAdjacentColumn(editor, source, target, side)) return true;
  }

  if (source.parentPos !== target.parentPos && !(isImageLayoutCapableNode(source.node) && isImageLayoutCapableNode(target.node))) return false;
  if (source.node.type.name === 'localColumnsBlock' || target.node.type.name === 'localColumnsBlock') {
    return false;
  }

  return moveBlockIntoColumns(editor, toEditorBlockRef(source), toEditorBlockRef(target), side);
}

/** 是否允许左右并排落点（图片排版或分栏） */
export function canSideLayoutDrop(
  editor: Editor,
  source: BlockPos | null,
  target: BlockPos | null,
): boolean {
  if (!source || !target || source.pos === target.pos) {
    // 排版块内：单格左右缘仍可插入/并排
    if (source && target && source.pos === target.pos && target.node.type.name === 'localImageGridBlock') {
      return true;
    }
    return false;
  }

  if (target.node.type.name === 'localImageGridBlock' && isImageLayoutCapableNode(source.node)) {
    return source.parentPos === target.parentPos;
  }

  if (isImageLayoutCapableNode(source.node) && isImageLayoutCapableNode(target.node)) {
    return true;
  }

  if (source.node.type.name === 'localColumnsBlock') return false;

  const doc = editor.state.doc;
  const targetCtx = findColumnsContext(doc, target.pos);
  const sourceCtx = findColumnsContext(doc, source.pos);
  // 飞书：外侧块拖到已有分栏左右 → 加栏
  if (targetCtx && (!sourceCtx || sourceCtx.columnsPos !== targetCtx.columnsPos)) {
    return true;
  }

  if (source.parentPos !== target.parentPos) return false;
  if (target.node.type.name === 'localColumnsBlock') return false;
  return true;
}

export type ImageGridDragHints = {
  sourceCellIndex?: number | null;
  targetCellIndex?: number | null;
  targetInsertIndex?: number | null;
};

function readGridColumnCount(node: ProseMirrorNode): number {
  return Number(node.attrs.columnCount) || 2;
}

function replaceSourceGridAfterExtract(
  tr: Transaction,
  source: BlockPos,
  remaining: ImageGridCellData[],
): Transaction {
  const gridType = tr.doc.type.schema.nodes.localImageGridBlock;
  const imageType = tr.doc.type.schema.nodes.image;
  if (!gridType || !imageType) return tr;
  const from = source.pos;
  const to = from + source.node.nodeSize;
  if (remaining.length === 0) return tr.delete(from, to);
  if (remaining.length === 1) {
    const cell = remaining[0];
    return tr.replaceWith(
      from,
      to,
      imageType.create({ src: cell.src, alt: cell.alt || '', blockId: source.node.attrs.blockId }),
    );
  }
  return tr.replaceWith(
    from,
    to,
    gridType.create({
      images: stringifyGridImagesAttr(remaining),
      columnCount: resolveGridColumnCount(readGridColumnCount(source.node), remaining.length),
      blockId: source.node.attrs.blockId,
    }),
  );
}

/** 图片排版单元格级拖放（格内重排、插入、抽出） */
function applyImageGridDrag(
  editor: Editor,
  source: BlockPos,
  target: BlockPos,
  placement: BlockDragPlacement,
  hints: ImageGridDragHints,
): boolean | null {
  const sourceIsGrid = source.node.type.name === 'localImageGridBlock';
  const targetIsGrid = target.node.type.name === 'localImageGridBlock';
  const sourceCellIndex = hints.sourceCellIndex ?? -1;
  const hasTargetInsert = hints.targetInsertIndex != null && hints.targetInsertIndex >= 0;
  const targetInsertIndex = hasTargetInsert ? hints.targetInsertIndex! : -1;

  const gridType = editor.schema.nodes.localImageGridBlock;

  // 单图拖入已有排版
  if (!sourceIsGrid && targetIsGrid && hasTargetInsert && isImageLayoutCapableNode(source.node)) {
    const imageType = editor.schema.nodes.image;
    if (!gridType || !imageType) return false;
    const incoming = readImageLayoutCells(source.node);
    const targetImages = readImageLayoutCells(target.node);
    if (!incoming?.length || !targetImages) return false;
    const merged = insertImagesAtIndex(targetImages, targetInsertIndex, incoming);
    let tr = editor.state.tr;
    if (source.pos < target.pos) {
      tr = tr.delete(source.pos, source.pos + source.node.nodeSize);
      const mappedTarget = tr.mapping.map(target.pos);
      const targetNode = tr.doc.nodeAt(mappedTarget);
      if (!targetNode) return false;
      tr = tr.replaceWith(
        mappedTarget,
        mappedTarget + targetNode.nodeSize,
        gridType.create({
          images: stringifyGridImagesAttr(merged),
          columnCount: resolveGridColumnCount(readGridColumnCount(target.node), merged.length),
          blockId: target.node.attrs.blockId,
        }),
      );
    } else {
      tr = tr.replaceWith(
        target.pos,
        target.pos + target.node.nodeSize,
        gridType.create({
          images: stringifyGridImagesAttr(merged),
          columnCount: resolveGridColumnCount(readGridColumnCount(target.node), merged.length),
          blockId: target.node.attrs.blockId,
        }),
      );
      const mappedSource = tr.mapping.map(source.pos);
      const sourceNode = tr.doc.nodeAt(mappedSource);
      if (sourceNode) tr = tr.delete(mappedSource, mappedSource + sourceNode.nodeSize);
    }
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
    return true;
  }

  if (!sourceIsGrid && !targetIsGrid) return null;
  if (sourceIsGrid && sourceCellIndex < 0) return null;
  if (!gridType) return false;

  const imageType = editor.schema.nodes.image;
  if (!imageType) return false;

  const sourceImages = readImageLayoutCells(source.node);
  if (!sourceImages?.length || sourceCellIndex >= sourceImages.length) return false;
  const movingCell = sourceImages[sourceCellIndex];
  if (!movingCell) return false;

  // 同一块内调序 / 侧向插入
  if (source.pos === target.pos && targetIsGrid && hasTargetInsert) {
    const reordered = moveImageWithinGrid(sourceImages, sourceCellIndex, targetInsertIndex);
    return writeImageGridAtPos(
      editor,
      source.pos,
      reordered,
      readGridColumnCount(source.node),
      source.node.attrs.blockId,
    );
  }

  // 拖出排版 → 独立图片块（上下落点到非排版块）
  if (
    (placement === 'before' || placement === 'after')
    && !targetIsGrid
    && !isImageLayoutCapableNode(target.node)
  ) {
    const remaining = removeImageAtIndex(sourceImages, sourceCellIndex);
    const imageNode = imageType.create({ src: movingCell.src, alt: movingCell.alt || '' });
    let tr = replaceSourceGridAfterExtract(editor.state.tr, source, remaining);
    const targetFrom = tr.mapping.map(target.pos);
    const targetNode = tr.doc.nodeAt(targetFrom);
    if (!targetNode) return false;
    const insertPos = placement === 'before' ? targetFrom : targetFrom + targetNode.nodeSize;
    tr = tr.insert(insertPos, imageNode);
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
    return true;
  }

  // 并入目标排版
  if (targetIsGrid && hasTargetInsert) {
    const targetImages = readImageLayoutCells(target.node);
    if (!targetImages) return false;

    if (source.pos === target.pos) {
      const reordered = moveImageWithinGrid(targetImages, sourceCellIndex, targetInsertIndex);
      return writeImageGridAtPos(
        editor,
        target.pos,
        reordered,
        readGridColumnCount(target.node),
        target.node.attrs.blockId,
      );
    }

    const remaining = removeImageAtIndex(sourceImages, sourceCellIndex);
    const merged = insertImagesAtIndex(targetImages, targetInsertIndex, [movingCell]);
    let tr = editor.state.tr;
    if (source.pos < target.pos) {
      tr = replaceSourceGridAfterExtract(tr, source, remaining);
      const mappedTarget = tr.mapping.map(target.pos);
      const targetNode = tr.doc.nodeAt(mappedTarget);
      if (!targetNode) return false;
      tr = tr.replaceWith(
        mappedTarget,
        mappedTarget + targetNode.nodeSize,
        gridType.create({
          images: stringifyGridImagesAttr(merged),
          columnCount: resolveGridColumnCount(readGridColumnCount(target.node), merged.length),
          blockId: target.node.attrs.blockId,
        }),
      );
    } else {
      tr = tr.replaceWith(
        target.pos,
        target.pos + target.node.nodeSize,
        gridType.create({
          images: stringifyGridImagesAttr(merged),
          columnCount: resolveGridColumnCount(readGridColumnCount(target.node), merged.length),
          blockId: target.node.attrs.blockId,
        }),
      );
      const mappedSource = tr.mapping.map(source.pos);
      const sourceNode = tr.doc.nodeAt(mappedSource);
      if (!sourceNode) return false;
      tr = replaceSourceGridAfterExtract(
        tr,
        { ...source, pos: mappedSource, node: sourceNode },
        remaining,
      );
    }
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
    return true;
  }

  // 排版内单格 ↔ 单图：左右缘合并为新排版
  if (
    sourceIsGrid
    && sourceCellIndex >= 0
    && !targetIsGrid
    && isImageLayoutCapableNode(target.node)
    && (placement === 'left' || placement === 'right')
  ) {
    const targetImages = readImageLayoutCells(target.node);
    if (!targetImages?.length) return false;
    const merged = placement === 'left'
      ? [movingCell, ...targetImages]
      : [...targetImages, movingCell];
    const remaining = removeImageAtIndex(sourceImages, sourceCellIndex);
    const nextGrid = gridType.create({
      images: stringifyGridImagesAttr(merged),
      columnCount: resolveGridColumnCount(2, merged.length),
      blockId: target.node.attrs.blockId || source.node.attrs.blockId || null,
    });
    let tr = editor.state.tr;
    if (source.pos < target.pos) {
      tr = replaceSourceGridAfterExtract(tr, source, remaining);
      const mappedTarget = tr.mapping.map(target.pos);
      const targetNode = tr.doc.nodeAt(mappedTarget);
      if (!targetNode) return false;
      tr = tr.replaceWith(mappedTarget, mappedTarget + targetNode.nodeSize, nextGrid);
    } else {
      tr = tr.replaceWith(target.pos, target.pos + target.node.nodeSize, nextGrid);
      const mappedSource = tr.mapping.map(source.pos);
      const sourceNode = tr.doc.nodeAt(mappedSource);
      if (!sourceNode) return false;
      tr = replaceSourceGridAfterExtract(
        tr,
        { ...source, pos: mappedSource, node: sourceNode },
        remaining,
      );
    }
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
    return true;
  }

  return null;
}

export function moveBlocksIntoImageGrid(
  editor: Editor,
  sourceEl: HTMLElement | null,
  targetEl: HTMLElement | null,
  side: 'left' | 'right',
  resolved?: {
    source: BlockPos;
    target: BlockPos;
    targetInsertIndex?: number;
    sourceCellIndex?: number;
  },
): boolean {
  const source = resolved?.source ?? resolveDraggableBlockPos(editor, sourceEl);
  const target = resolved?.target ?? resolveDraggableBlockPos(editor, targetEl);
  if (!source || !target) return false;
  if (source.pos === target.pos) return false;
  if (source.parentPos !== target.parentPos) return false;

  let sourceImages = readImageLayoutCells(source.node);
  const targetImages = readImageLayoutCells(target.node);
  if (!sourceImages?.length || !targetImages?.length) return false;

  const gridType = editor.schema.nodes.localImageGridBlock;
  if (!gridType) return false;

  const sourceCellIndex = resolved?.sourceCellIndex ?? -1;
  let sourceGridRemaining: ImageGridCellData[] | null = null;
  if (source.node.type.name === 'localImageGridBlock' && sourceCellIndex >= 0) {
    sourceGridRemaining = removeImageAtIndex(sourceImages, sourceCellIndex);
    const cell = sourceImages[sourceCellIndex];
    if (!cell) return false;
    sourceImages = [cell];
  }

  if (target.node.type.name === 'localImageGridBlock' && resolved?.targetInsertIndex != null) {
    const merged = insertImagesAtIndex(targetImages, resolved.targetInsertIndex, sourceImages);
    const columnCount = resolveGridColumnCount(readGridColumnCount(target.node), merged.length);
    let tr = editor.state.tr;
    if (sourceGridRemaining != null) {
      if (source.pos < target.pos) {
        tr = replaceSourceGridAfterExtract(tr, source, sourceGridRemaining);
        const mappedTarget = tr.mapping.map(target.pos);
        const targetNode = tr.doc.nodeAt(mappedTarget);
        if (!targetNode) return false;
        tr = tr.replaceWith(
          mappedTarget,
          mappedTarget + targetNode.nodeSize,
          gridType.create({ images: stringifyGridImagesAttr(merged), columnCount, blockId: target.node.attrs.blockId }),
        );
      } else {
        tr = tr.replaceWith(
          target.pos,
          target.pos + target.node.nodeSize,
          gridType.create({ images: stringifyGridImagesAttr(merged), columnCount, blockId: target.node.attrs.blockId }),
        );
        const mappedSource = tr.mapping.map(source.pos);
        const sourceNode = tr.doc.nodeAt(mappedSource);
        if (!sourceNode) return false;
        tr = replaceSourceGridAfterExtract(
          tr,
          { ...source, pos: mappedSource, node: sourceNode },
          sourceGridRemaining,
        );
      }
    } else if (source.pos < target.pos) {
      tr = tr.delete(source.pos, source.pos + source.node.nodeSize);
      const mappedTarget = tr.mapping.map(target.pos);
      const targetNode = tr.doc.nodeAt(mappedTarget);
      if (!targetNode) return false;
      tr = tr.replaceWith(
        mappedTarget,
        mappedTarget + targetNode.nodeSize,
        gridType.create({ images: stringifyGridImagesAttr(merged), columnCount, blockId: target.node.attrs.blockId }),
      );
    } else {
      tr = tr.replaceWith(
        target.pos,
        target.pos + target.node.nodeSize,
        gridType.create({ images: stringifyGridImagesAttr(merged), columnCount, blockId: target.node.attrs.blockId }),
      );
      const mappedSource = tr.mapping.map(source.pos);
      const sourceNode = tr.doc.nodeAt(mappedSource);
      if (sourceNode) tr = tr.delete(mappedSource, mappedSource + sourceNode.nodeSize);
    }
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
    return true;
  }

  const merged = side === 'left'
    ? [...sourceImages, ...targetImages]
    : [...targetImages, ...sourceImages];
  const preferredCols = target.node.type.name === 'localImageGridBlock'
    ? readGridColumnCount(target.node)
    : source.node.type.name === 'localImageGridBlock'
      ? readGridColumnCount(source.node)
      : 2;
  const columnCount = resolveGridColumnCount(preferredCols, merged.length);
  const gridNode = gridType.create({
    images: stringifyGridImagesAttr(merged),
    columnCount,
    blockId: target.node.attrs.blockId || source.node.attrs.blockId || null,
  });

  const sourceFrom = source.pos;
  const sourceTo = source.pos + source.node.nodeSize;
  const sourceSize = sourceTo - sourceFrom;
  let tr = editor.state.tr;
  let targetFrom = target.pos;
  let targetTo = target.pos + target.node.nodeSize;

  if (sourceGridRemaining != null) {
    if (sourceFrom < targetFrom) {
      tr = replaceSourceGridAfterExtract(tr, source, sourceGridRemaining);
      targetFrom = tr.mapping.map(target.pos);
      targetTo = targetFrom + (tr.doc.nodeAt(targetFrom)?.nodeSize ?? target.node.nodeSize);
      tr = tr.replaceWith(targetFrom, targetTo, gridNode);
    } else {
      tr = tr.replaceWith(targetFrom, targetTo, gridNode);
      const mappedSource = tr.mapping.map(sourceFrom);
      const sourceNode = tr.doc.nodeAt(mappedSource);
      if (!sourceNode) return false;
      tr = replaceSourceGridAfterExtract(
        tr,
        { ...source, pos: mappedSource, node: sourceNode },
        sourceGridRemaining,
      );
    }
  } else if (sourceFrom < targetFrom) {
    tr = tr.delete(sourceFrom, sourceTo);
    targetFrom -= sourceSize;
    targetTo -= sourceSize;
    tr = tr.replaceWith(targetFrom, targetTo, gridNode);
  } else {
    tr = tr.delete(sourceFrom, sourceTo);
    tr = tr.replaceWith(targetFrom, targetTo, gridNode);
  }

  try {
    const inserted = tr.doc.nodeAt(targetFrom);
    if (inserted && NodeSelection.isSelectable(inserted)) {
      tr = tr.setSelection(NodeSelection.create(tr.doc, targetFrom));
    }
  } catch {
    /* keep mapped selection */
  }

  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

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

const CONTAINER_ROOT_SELECTOR =
  '.feishu-table-host, .tableWrapper, .feishu-file-block, .feishu-image-block-wrap, '
  + '.feishu-bitable-block, .feishu-div-table, .feishu-sync-block, .feishu-button-block, '
  + '.feishu-formula-editor, .feishu-local-card, .feishu-columns-block, .feishu-columns-node, .feishu-image-grid';

/**
 * 仅当 blockEl 自身是容器/原子块根时才声明 preferredType。
 * 用 closest 会让分栏列内、表格单元格内的段落被解析为整容器，
 * 导致拖拽误移整个分栏/表格（飞书期望列内/格内块可独立排序）。
 */
function resolvePreferredNodeType(blockEl: HTMLElement): string | null {
  if (!blockEl.matches(CONTAINER_ROOT_SELECTOR)) return null;
  if (blockEl.matches('.feishu-table-host, .tableWrapper')) return 'table';
  if (blockEl.matches('.feishu-file-block')) return 'localFileBlock';
  if (blockEl.matches('.feishu-image-block-wrap')) return 'image';
  if (blockEl.matches('.feishu-bitable-block')) return 'localBitableBlock';
  if (blockEl.matches('.feishu-div-table')) return 'localDivTableBlock';
  if (blockEl.matches('.feishu-sync-block')) return 'localSyncBlock';
  if (blockEl.matches('.feishu-button-block')) return 'localButtonBlock';
  if (blockEl.matches('.feishu-formula-editor')) return 'localFormulaBlock';
  if (blockEl.matches('.feishu-local-card')) return 'localEmbedBlock';
  if (blockEl.matches('.feishu-image-grid')) return 'localImageGridBlock';
  if (blockEl.matches('.feishu-columns-block, .feishu-columns-node')) return 'localColumnsBlock';
  return null;
}

function normalizeDraggableBlockDom(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  const atomBlock = el.closest(
    '.feishu-bitable-block, .feishu-code-block, .feishu-highlight-block, .feishu-divider, .feishu-table-host, .tableWrapper, .feishu-image-block-wrap, .feishu-file-block--image, .feishu-button-block, .feishu-formula-editor, .feishu-div-table, .feishu-local-card, .feishu-file-block, .feishu-sync-block, .feishu-columns-block, .feishu-columns-node, .feishu-image-grid',
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

function resolveMappedInsertPos(
  tr: Transaction,
  source: BlockPos,
  target: BlockPos,
  placement: 'before' | 'after',
): number | null {
  const originalTargetPos = placement === 'before' ? target.pos : target.pos + target.node.nodeSize;
  const mappedPos = tr.mapping.map(originalTargetPos, placement === 'before' ? -1 : 1);
  if (mappedPos === source.pos) return null;
  if (mappedPos < 0 || mappedPos > tr.doc.content.size) return null;
  const $insert = tr.doc.resolve(mappedPos);
  const index = $insert.index();
  if (!$insert.parent.canReplaceWith(index, index, source.node.type, source.node.marks)) return null;
  return mappedPos;
}

export function moveDraggableBlock(
  editor: Editor,
  sourceEl: HTMLElement | null,
  targetEl: HTMLElement | null,
  placement: BlockDragPlacement,
  hints: ImageGridDragHints = {},
): boolean {
  const source = resolveDraggableBlockPos(editor, sourceEl);
  const target = resolveDraggableBlockPos(editor, targetEl);
  if (!source || !target) return false;

  const gridResult = applyImageGridDrag(editor, source, target, placement, hints);
  if (gridResult === true) return true;
  if (gridResult === false) return false;

  // 单图 → 排版左右合并（含外部图拖入已有 grid 侧缘但未带 cell index 的情况）
  if (placement === 'left' || placement === 'right') {
    if (
      source.pos !== target.pos
      && isImageLayoutCapableNode(source.node)
      && isImageLayoutCapableNode(target.node)
    ) {
      if (
        source.node.type.name !== 'localImageGridBlock'
        || (hints.sourceCellIndex != null && hints.sourceCellIndex >= 0)
      ) {
        return moveBlocksIntoImageGrid(editor, sourceEl, targetEl, placement, {
          source,
          target,
          targetInsertIndex: hints.targetInsertIndex ?? undefined,
          sourceCellIndex: hints.sourceCellIndex ?? undefined,
        });
      }
    }
    return moveBlocksIntoColumnsLayout(editor, sourceEl, targetEl, placement);
  }

  // 整格排版块移动（非单元格级）
  if (source.node.type.name === 'localImageGridBlock' && (hints.sourceCellIndex == null || hints.sourceCellIndex < 0)) {
    // fall through to generic block move
  } else if (source.node.type.name === 'localImageGridBlock') {
    return false;
  }

  const sourceFrom = source.pos;
  const sourceTo = source.pos + source.node.nodeSize;
  const tr = editor.state.tr.delete(sourceFrom, sourceTo);
  let insertPos = source.parentPos === target.parentPos
    ? computeMoveInsertPos(source, target, placement)
    : resolveMappedInsertPos(tr, source, target, placement);
  if (insertPos == null) {
    const fallbackPlacement = placement === 'before' ? 'after' : 'before';
    insertPos = source.parentPos === target.parentPos
      ? computeMoveInsertPos(source, target, fallbackPlacement)
      : resolveMappedInsertPos(tr, source, target, fallbackPlacement);
  }
  if (insertPos == null) return false;

  try {
    tr.insert(insertPos, source.node);
  } catch {
    return false;
  }
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
