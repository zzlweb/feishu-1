import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import type { ImageGridCellData } from './feishuBlockDrag';

/** 贴近左右缘 / 列缝时才触发并排（像素级，非百分比区域） */
export const IMAGE_GRID_SIDE_EDGE_HIT_PX = 12;
export const IMAGE_GRID_COLUMN_GAP_HIT_PX = 10;
export const IMAGE_GRID_DROP_LINE_WIDTH = 2;

export type ImageGridCellDrop = {
  cellIndex: number;
  cellRect: DOMRect;
  /** 指示线位置（固定 2px 竖线或横线） */
  lineRect: DOMRect;
  placement: 'before' | 'after' | 'left' | 'right';
  insertIndex: number;
};

function buildVerticalLineRect(x: number, top: number, height: number): DOMRect {
  return new DOMRect(
    x - IMAGE_GRID_DROP_LINE_WIDTH / 2,
    top,
    IMAGE_GRID_DROP_LINE_WIDTH,
    height,
  );
}

function buildHorizontalLineRect(left: number, y: number, width: number): DOMRect {
  return new DOMRect(
    left,
    y - IMAGE_GRID_DROP_LINE_WIDTH / 2,
    width,
    IMAGE_GRID_DROP_LINE_WIDTH,
  );
}

/** 按单元格检测落点：列缝/格缘为细竖线，格内其余区域为上下横线 */
export function resolveImageGridCellDrop(
  gridEl: HTMLElement,
  clientX: number,
  clientY: number,
): ImageGridCellDrop | null {
  const cells = Array.from(gridEl.querySelectorAll(':scope .feishu-image-grid__cell')) as HTMLElement[];
  if (!cells.length) return null;

  // 同一行相邻单元格之间的列缝（两栏中间）
  for (let index = 0; index < cells.length - 1; index += 1) {
    const leftRect = cells[index].getBoundingClientRect();
    const rightRect = cells[index + 1].getBoundingClientRect();
    const sameRow = Math.abs(leftRect.top - rightRect.top) < 16
      && Math.abs(leftRect.bottom - rightRect.bottom) < 16;
    if (!sameRow) continue;

    const gapCenter = (leftRect.right + rightRect.left) / 2;
    const naturalHalf = Math.max(0, (rightRect.left - leftRect.right) / 2);
    const hitHalf = Math.max(IMAGE_GRID_COLUMN_GAP_HIT_PX, naturalHalf + 4);
    const top = Math.min(leftRect.top, rightRect.top);
    const bottom = Math.max(leftRect.bottom, rightRect.bottom);
    if (clientX >= gapCenter - hitHalf && clientX <= gapCenter + hitHalf
      && clientY >= top && clientY <= bottom) {
      return {
        cellIndex: index,
        cellRect: leftRect,
        lineRect: buildVerticalLineRect(gapCenter, top, bottom - top),
        placement: 'right',
        insertIndex: index + 1,
      };
    }
  }

  for (let index = 0; index < cells.length; index += 1) {
    const rect = cells[index].getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      continue;
    }

    const distLeft = clientX - rect.left;
    const distRight = rect.right - clientX;

    if (distLeft <= IMAGE_GRID_SIDE_EDGE_HIT_PX) {
      return {
        cellIndex: index,
        cellRect: rect,
        lineRect: buildVerticalLineRect(rect.left, rect.top, rect.height),
        placement: 'left',
        insertIndex: index,
      };
    }
    if (distRight <= IMAGE_GRID_SIDE_EDGE_HIT_PX) {
      return {
        cellIndex: index,
        cellRect: rect,
        lineRect: buildVerticalLineRect(rect.right, rect.top, rect.height),
        placement: 'right',
        insertIndex: index + 1,
      };
    }

    const relY = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    const before = relY < 0.5;
    return {
      cellIndex: index,
      cellRect: rect,
      lineRect: buildHorizontalLineRect(
        rect.left,
        before ? rect.top : rect.bottom,
        rect.width,
      ),
      placement: before ? 'before' : 'after',
      insertIndex: before ? index : index + 1,
    };
  }

  return null;
}

export function findImageGridCellIndex(gridEl: HTMLElement, imgEl: HTMLElement): number {
  const cell = imgEl.closest('.feishu-image-grid__cell');
  if (!cell) return -1;
  const cells = Array.from(gridEl.querySelectorAll(':scope .feishu-image-grid__cell'));
  return cells.indexOf(cell);
}

export function insertImagesAtIndex(
  images: ImageGridCellData[],
  insertIndex: number,
  incoming: ImageGridCellData[],
): ImageGridCellData[] {
  const next = [...images];
  next.splice(Math.max(0, Math.min(insertIndex, next.length)), 0, ...incoming);
  return next;
}

export function removeImageAtIndex(images: ImageGridCellData[], index: number): ImageGridCellData[] {
  if (index < 0 || index >= images.length) return images;
  return images.filter((_, i) => i !== index);
}

export function moveImageWithinGrid(
  images: ImageGridCellData[],
  fromIndex: number,
  insertIndex: number,
): ImageGridCellData[] {
  if (fromIndex < 0 || fromIndex >= images.length) return images;
  const next = [...images];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return images;
  let target = insertIndex;
  if (fromIndex < insertIndex) target -= 1;
  next.splice(Math.max(0, Math.min(target, next.length)), 0, item);
  return next;
}

export function resolveGridColumnCount(current: number, imageCount: number): number {
  if (imageCount <= 1) return 1;
  // 图片排版随数量收缩/扩展：2 张两列，3 张及以上三列。
  // 不保留已过大的旧列数，避免移走图片后留下空列。
  if (imageCount <= 2) return 2;
  return Math.min(6, Math.max(3, Math.round(current || 3)));
}

export function writeImageGridAtPos(
  editor: Editor,
  pos: number,
  images: ImageGridCellData[],
  columnCount: number,
  blockId?: unknown,
): boolean {
  const gridType = editor.schema.nodes.localImageGridBlock;
  const imageType = editor.schema.nodes.image;
  if (!gridType || !imageType) return false;

  if (images.length === 0) {
    editor.view.dispatch(editor.state.tr.delete(pos, pos + (editor.state.doc.nodeAt(pos)?.nodeSize || 0)).scrollIntoView());
    return true;
  }

  if (images.length === 1) {
    const cell = images[0];
    const imageNode = imageType.create({
      src: cell.src,
      alt: cell.alt || '',
      ...(cell.align ? { align: cell.align } : {}),
      ...(cell.caption ? { caption: cell.caption } : {}),
      ...(cell.captionVisible ? { captionVisible: true } : {}),
      ...(cell.originalSrc ? { originalSrc: cell.originalSrc } : {}),
      blockId: typeof blockId === 'string' ? blockId : null,
    });
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return false;
    editor.view.dispatch(
      editor.state.tr.replaceWith(pos, pos + node.nodeSize, imageNode).scrollIntoView(),
    );
    return true;
  }

  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;
  const nextGrid = gridType.create({
    images: JSON.stringify(images.map(image => ({
      src: image.src,
      ...(image.alt ? { alt: image.alt } : {}),
      ...(image.align ? { align: image.align } : {}),
      ...(image.caption ? { caption: image.caption } : {}),
      ...(image.captionVisible ? { captionVisible: true } : {}),
      ...(image.originalSrc ? { originalSrc: image.originalSrc } : {}),
    }))),
    columnCount: resolveGridColumnCount(columnCount, images.length),
    blockId: blockId ?? node.attrs.blockId ?? null,
  });
  let tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, nextGrid);
  try {
    if (NodeSelection.isSelectable(nextGrid)) {
      tr = tr.setSelection(NodeSelection.create(tr.doc, pos));
    }
  } catch {
    /* ignore */
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}
