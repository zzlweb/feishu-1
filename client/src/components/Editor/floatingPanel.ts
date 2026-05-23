import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface FloatingPanelPosition {
  x: number;
  y: number;
}

export function clampPanelY(anchor: DOMRect, menuH: number, pad: number): number {
  const vh = window.innerHeight;
  const anchorCenterY = anchor.top + anchor.height / 2;
  const y = anchorCenterY - menuH / 2;
  return Math.max(pad, Math.min(y, vh - pad - menuH));
}

/** 块配置面板：优先在块柄左侧展示，减少遮挡正文；左侧放不下时再切到右侧 */
export function computeBlockPanelPosition(
  anchor: DOMRect,
  menuW = 230,
  menuH = 420,
  pad = 8,
  gap = 4,
): FloatingPanelPosition {
  const vw = window.innerWidth;

  const leftX = anchor.left - gap - menuW;
  const rightX = anchor.right + gap;
  const fitsLeft = leftX >= pad;
  const fitsRight = rightX + menuW <= vw - pad;

  if (fitsLeft) {
    return { x: leftX, y: clampPanelY(anchor, menuH, pad) };
  }

  let x = fitsRight ? rightX : Math.min(Math.max(leftX, pad), vw - menuW - pad);
  x = Math.max(pad, Math.min(x, vw - menuW - pad));
  return { x, y: clampPanelY(anchor, menuH, pad) };
}

function clampFloatingPanelPosition(
  next: FloatingPanelPosition,
  menuW: number,
  menuH: number,
  pad = 8,
): FloatingPanelPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.max(pad, Math.min(next.x, vw - menuW - pad)),
    y: Math.max(pad, Math.min(next.y, vh - menuH - pad)),
  };
}

/** 块/表格配置菜单：直接读取锚点 DOM，portal 到 body 后仍与块柄对齐 */
export function useAnchoredContextMenuPosition(
  anchorRef: RefObject<HTMLElement | null> | undefined,
  panelRef: RefObject<HTMLElement | null>,
  fallback: FloatingPanelPosition,
  computePosition: (anchor: DOMRect, menuW: number, menuH: number) => FloatingPanelPosition = computeBlockPanelPosition,
) {
  const [finalPos, setFinalPos] = useState<FloatingPanelPosition>(fallback);
  const [posVisible, setPosVisible] = useState(false);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const update = () => {
      const panelRect = panel.getBoundingClientRect();
      const menuW = panelRect.width || 236;
      const menuH = panelRect.height || 420;
      const anchorEl = anchorRef?.current;
      const raw = anchorEl?.isConnected
        ? computePosition(anchorEl.getBoundingClientRect(), menuW, menuH)
        : fallback;
      const next = clampFloatingPanelPosition(raw, menuW, menuH);
      setFinalPos(prev => (prev.x === next.x && prev.y === next.y ? prev : next));
      setPosVisible(true);
    };

    update();
    const raf = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, panelRef, fallback.x, fallback.y, computePosition]);

  return { finalPos, posVisible };
}

export function isPointerWithinFloatingShell(
  next: EventTarget | null,
  refs: Array<RefObject<HTMLElement | null> | undefined>,
  selectors: string[],
) {
  if (!(next instanceof Element)) return false;
  for (const ref of refs) {
    if (ref?.current?.contains(next)) return true;
  }
  for (const selector of selectors) {
    if (next.closest(selector)) return true;
  }
  return false;
}

export interface HoverFloatingGroupOptions {
  refs?: Array<RefObject<HTMLElement | null> | undefined>;
  selectors?: string[];
  closeDelay?: number;
  onClose?: () => void;
}

export function useHoverFloatingGroup({
  refs = [],
  selectors = [],
  closeDelay = 160,
  onClose,
}: HoverFloatingGroupOptions) {
  const closeTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  const refsRef = useRef(refs);
  const selectorsRef = useRef(selectors);

  onCloseRef.current = onClose;
  refsRef.current = refs;
  selectorsRef.current = selectors;

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current == null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const containsTarget = useCallback((target: EventTarget | null) => {
    return isPointerWithinFloatingShell(target, refsRef.current, selectorsRef.current);
  }, []);

  const scheduleClose = useCallback((target?: EventTarget | null) => {
    if (target && containsTarget(target)) {
      cancelClose();
      return;
    }
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      const active = document.activeElement;
      if (active && containsTarget(active)) return;
      onCloseRef.current?.();
    }, closeDelay);
  }, [cancelClose, closeDelay, containsTarget]);

  const getHoverProps = useCallback(() => ({
    onPointerEnter: () => {
      cancelClose();
    },
    onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => {
      scheduleClose(event.relatedTarget);
    },
  }), [cancelClose, scheduleClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  return {
    cancelClose,
    scheduleClose,
    containsTarget,
    getHoverProps,
  };
}
