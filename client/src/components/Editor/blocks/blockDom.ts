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

