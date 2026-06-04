import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface FloatingPanelPosition {
  x: number;
  y: number;
}

export type FloatingPanelPlacement = 'bottom-start' | 'top-start' | 'right-start' | 'left-start';

export interface FloatingPanelRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface AnchoredFloatingPanelPosition {
  left: number;
  top: number;
  maxHeight: number;
  placement: FloatingPanelPlacement;
  visibility: 'hidden' | 'visible';
}

export interface AnchoredFloatingPanelOptions {
  placement?: FloatingPanelPlacement;
  gap?: number;
  pad?: number;
  fallbackWidth?: number;
  fallbackHeight?: number;
  matchAnchorWidth?: boolean;
  minMaxHeight?: number;
}

function viewportRect() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

export function pointToFloatingRect(left: number, top: number, size = 1): FloatingPanelRect {
  return { left, top, right: left + size, bottom: top + size, width: size, height: size };
}

export function elementToFloatingRect(element: HTMLElement): FloatingPanelRect {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export function computeAnchoredFloatingPosition(
  anchor: FloatingPanelRect,
  panelWidth: number,
  panelHeight: number,
  options: AnchoredFloatingPanelOptions = {},
): AnchoredFloatingPanelPosition {
  const {
    placement = 'bottom-start',
    gap = 4,
    pad = 8,
    minMaxHeight = 120,
  } = options;
  const viewport = viewportRect();
  const width = Math.max(1, panelWidth);
  const height = Math.max(1, panelHeight);
  let nextPlacement = placement;
  let left = anchor.left;
  let top = anchor.bottom + gap;

  if (placement === 'top-start') {
    top = anchor.top - gap - height;
    if (top < pad && anchor.bottom + gap + height <= viewport.height - pad) {
      nextPlacement = 'bottom-start';
      top = anchor.bottom + gap;
    }
  } else if (placement === 'bottom-start') {
    top = anchor.bottom + gap;
    if (top + height > viewport.height - pad && anchor.top - gap - height >= pad) {
      nextPlacement = 'top-start';
      top = anchor.top - gap - height;
    }
  } else if (placement === 'right-start') {
    left = anchor.right + gap;
    top = anchor.top;
    if (left + width > viewport.width - pad && anchor.left - gap - width >= pad) {
      nextPlacement = 'left-start';
      left = anchor.left - gap - width;
    }
  } else if (placement === 'left-start') {
    left = anchor.left - gap - width;
    top = anchor.top;
    if (left < pad && anchor.right + gap + width <= viewport.width - pad) {
      nextPlacement = 'right-start';
      left = anchor.right + gap;
    }
  }

  if (nextPlacement === 'bottom-start' || nextPlacement === 'top-start') {
    left = clampNumber(left, pad, viewport.width - width - pad);
  } else {
    left = clampNumber(left, pad, viewport.width - width - pad);
    top = clampNumber(top, pad, viewport.height - height - pad);
  }

  top = clampNumber(top, pad, viewport.height - Math.min(height, viewport.height - pad * 2) - pad);
  const maxHeight = Math.max(minMaxHeight, viewport.height - top - pad);

  return {
    left,
    top,
    maxHeight,
    placement: nextPlacement,
    visibility: 'visible',
  };
}

export function useAnchoredFloatingPosition(
  anchorRef: RefObject<HTMLElement | null> | undefined,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  options: AnchoredFloatingPanelOptions & { anchorRect?: FloatingPanelRect | null } = {},
) {
  const {
    anchorRect,
    fallbackWidth = 240,
    fallbackHeight = 320,
    matchAnchorWidth = false,
    ...positionOptions
  } = options;
  const [style, setStyle] = useState<AnchoredFloatingPanelPosition & { width?: number }>({
    left: 0,
    top: 0,
    maxHeight: fallbackHeight,
    placement: positionOptions.placement || 'bottom-start',
    visibility: 'hidden',
    width: matchAnchorWidth ? fallbackWidth : undefined,
  });

  useLayoutEffect(() => {
    if (!open) return undefined;

    let raf = 0;
    const update = () => {
      const anchorEl = anchorRef?.current;
      const anchor = anchorEl?.isConnected ? elementToFloatingRect(anchorEl) : anchorRect;
      if (!anchor) return;
      const panelRect = panelRef.current?.getBoundingClientRect();
      const panelWidth = matchAnchorWidth ? anchor.width : (panelRect?.width || fallbackWidth);
      const panelHeight = panelRect?.height || fallbackHeight;
      const next = computeAnchoredFloatingPosition(anchor, panelWidth, panelHeight, positionOptions);
      const width = matchAnchorWidth ? anchor.width : undefined;
      setStyle(prev => (
        prev.left === next.left
        && prev.top === next.top
        && prev.maxHeight === next.maxHeight
        && prev.placement === next.placement
        && prev.visibility === next.visibility
        && prev.width === width
          ? prev
          : { ...next, width }
      ));
    };

    update();
    raf = window.requestAnimationFrame(update);
    const resizeObserver = typeof ResizeObserver !== 'undefined' && panelRef.current
      ? new ResizeObserver(update)
      : null;
    if (panelRef.current) resizeObserver?.observe(panelRef.current);
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  }, [
    anchorRef,
    panelRef,
    open,
    anchorRect?.left,
    anchorRect?.top,
    anchorRect?.right,
    anchorRect?.bottom,
    anchorRect?.width,
    anchorRect?.height,
    fallbackWidth,
    fallbackHeight,
    matchAnchorWidth,
    positionOptions.placement,
    positionOptions.gap,
    positionOptions.pad,
    positionOptions.minMaxHeight,
  ]);

  return style;
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
