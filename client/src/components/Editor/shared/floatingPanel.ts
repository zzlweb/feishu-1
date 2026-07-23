import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface FloatingPanelPosition {
  x: number;
  y: number;
  maxX?: number;
  minX?: number;
}

export type FloatingPanelPlacement = 'bottom-start' | 'top-start' | 'right-start' | 'left-start';

/** 与 styles/global.css `--z-*` / feishu-tokens.less `@z-*` 保持一致 */
export const FLOATING_Z_INDEX = {
  stickyHeader: 100,
  docFloating: 1000,
  docMenu: 10050,
  docSubmenu: 10051,
  bitablePanel: 10060,
  bitableModal: 10070,
  bitableMenu: 10080,
  notification: 10090,
} as const;

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

const WORKSPACE_SCROLL_SELECTOR = '.doc-page-workspace';
export const FEISHU_LAYOUT_SCROLL_EVENT = 'feishu-layout-scroll';

function isScrollableElement(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const values = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
  if (!/(auto|scroll|overlay)/.test(values)) return false;
  return element.scrollHeight > element.clientHeight + 1
    || element.scrollWidth > element.clientWidth + 1;
}

/** 收集文档工作区及锚点祖先上的滚动容器；scroll 事件不冒泡，不能只监听 document。 */
export function collectScrollContainers(anchor?: HTMLElement | null) {
  const containers = new Set<HTMLElement>();

  document.querySelectorAll<HTMLElement>(WORKSPACE_SCROLL_SELECTOR).forEach(el => {
    containers.add(el);
  });

  let node: HTMLElement | null = anchor ?? null;
  while (node) {
    if (isScrollableElement(node)) containers.add(node);
    node = node.parentElement;
  }

  if (anchor) {
    anchor.closest<HTMLElement>('.feishu-bitable-block')?.querySelectorAll<HTMLElement>(
      '.base-grid-shell, .base-view-content, .base-kanban__scroll, .feishu-table-host',
    ).forEach(el => {
      if (isScrollableElement(el)) containers.add(el);
    });
  }

  return Array.from(containers);
}

/** 绑定浮层在滚动/resize 时的位置同步；覆盖 .doc-page-workspace 等实际滚动容器。 */
export function bindFloatingLayoutListeners(
  update: () => void,
  anchor?: HTMLElement | null,
  options?: { runImmediately?: boolean },
) {
  let raf = 0;
  const scheduleUpdate = () => {
    if (raf) window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      update();
    });
  };

  const scrollTargets = collectScrollContainers(anchor);
  scrollTargets.forEach(target => {
    target.addEventListener('scroll', scheduleUpdate, { passive: true });
  });
  window.addEventListener(FEISHU_LAYOUT_SCROLL_EVENT, scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  document.addEventListener('wheel', scheduleUpdate, { passive: true, capture: true });
  if (options?.runImmediately !== false) {
    scheduleUpdate();
  }

  return () => {
    if (raf) window.cancelAnimationFrame(raf);
    scrollTargets.forEach(target => {
      target.removeEventListener('scroll', scheduleUpdate);
    });
    window.removeEventListener(FEISHU_LAYOUT_SCROLL_EVENT, scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    document.removeEventListener('wheel', scheduleUpdate, true);
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
    const cleanupLayout = bindFloatingLayoutListeners(update, anchorRef?.current);
    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      cleanupLayout();
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
  const viewportMaxX = vw - menuW - pad;
  const constrainedMaxX = typeof next.maxX === 'number'
    ? Math.min(viewportMaxX, next.maxX)
    : viewportMaxX;
  const constrainedMinX = typeof next.minX === 'number' ? next.minX : pad;
  return {
    x: Math.max(constrainedMinX, Math.min(next.x, constrainedMaxX)),
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
    const cleanupLayout = bindFloatingLayoutListeners(update, anchorRef?.current);
    return () => {
      window.cancelAnimationFrame(raf);
      cleanupLayout();
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

/** 用 :hover 判断指针是否仍在菜单壳内（比 relatedTarget 可靠，避免快速划出时误判）。 */
export function isFloatingShellHovered(
  refs: Array<RefObject<HTMLElement | null> | undefined>,
  selectors: string[],
): boolean {
  for (const ref of refs) {
    const el = ref?.current;
    if (el?.isConnected && el.matches(':hover')) return true;
  }
  for (const selector of selectors) {
    try {
      if (document.querySelector(`${selector}:hover`)) return true;
    } catch {
      // ignore invalid selector combinations
    }
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
  const respectFocusRef = useRef(false);

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

  const scheduleClose = useCallback((_target?: EventTarget | null, options: { respectFocus?: boolean } = {}) => {
    // 始终延时关闭：快速划出时 relatedTarget 可能落在块柄/锚点上，
    // 若此处直接 return，后续又收不到 leave，面板会卡住。
    // 到点用 :hover 与焦点复核；若仍在壳内则再次武装定时器，直到真正离开。
    respectFocusRef.current = Boolean(options.respectFocus);
    cancelClose();
    const tick = () => {
      closeTimerRef.current = null;
      if (isFloatingShellHovered(refsRef.current, selectorsRef.current)) {
        closeTimerRef.current = window.setTimeout(tick, closeDelay);
        return;
      }
      const active = document.activeElement;
      if (
        respectFocusRef.current
        && active
        && active !== document.body
        && containsTarget(active)
      ) {
        return;
      }
      onCloseRef.current?.();
    };
    closeTimerRef.current = window.setTimeout(tick, closeDelay);
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
