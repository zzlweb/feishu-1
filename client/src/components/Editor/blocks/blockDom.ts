import { sanitizeFeishuBlockId } from './feishuBlockId';

export function escapeSelectorValue(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

export function resolveBlockElement(root: ParentNode | null, blockId: string): HTMLElement | null {
  const id = sanitizeFeishuBlockId(blockId);
  if (!root || !id) return null;

  const escaped = escapeSelectorValue(id);
  const target = root.querySelector(
    [
      `#${escaped}`,
      `[data-block-id="${escaped}"]`,
      `[data-heading-id="${escaped}"]`,
      `[data-table-id="${escaped}"]`,
      `[data-comment-thread-id="${escaped}"]`,
    ].join(','),
  );
  return target instanceof HTMLElement ? target : null;
}

/** 列表项高亮/框选矩形：向左扩展到序号/项目符号区域，可选向右铺满内容区。 */
export function resolveListItemHighlightRect(
  li: HTMLElement,
  extendToRight?: number,
): DOMRect {
  const liRect = li.getBoundingClientRect();
  if (li.closest('ul[data-type="taskList"]')) {
    const right = extendToRight ?? liRect.right;
    return new DOMRect(liRect.left, liRect.top, Math.max(liRect.width, right - liRect.left), liRect.height);
  }

  const list = li.closest('ul, ol');
  if (!(list instanceof HTMLElement)) return liRect;

  const listRect = list.getBoundingClientRect();
  const left = listRect.left;
  const right = extendToRight ?? liRect.right;
  return new DOMRect(left, liRect.top, Math.max(1, right - left), liRect.height);
}

