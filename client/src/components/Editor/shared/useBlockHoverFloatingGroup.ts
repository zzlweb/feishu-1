import { useCallback, type RefObject } from 'react';
import { useHoverFloatingGroup } from './floatingPanel';

/**
 * 块柄 / 加号 / 表格柄共用的悬停保活组。
 * 从 Editor 抽出，避免块交互关闭策略继续堆在巨型组件内。
 */
export function useBlockHoverFloatingGroup(options: {
  refs: Array<RefObject<HTMLElement | null> | undefined>;
  selectors: string[];
  closeDelay?: number;
  onClose: () => void;
}) {
  const { refs, selectors, closeDelay = 160, onClose } = options;
  const group = useHoverFloatingGroup({
    refs,
    selectors,
    closeDelay,
    onClose,
  });

  const scheduleCloseUnlessTarget = useCallback(
    (target: EventTarget | null, keepIf?: (target: EventTarget | null) => boolean) => {
      if (keepIf?.(target)) return;
      group.scheduleClose(target);
    },
    [group.scheduleClose],
  );

  return {
    ...group,
    scheduleCloseUnlessTarget,
  };
}
