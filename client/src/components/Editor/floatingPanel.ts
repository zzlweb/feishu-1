import { useLayoutEffect, useState, type RefObject } from 'react';

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

interface PanelBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function panelOverlapsAnchor(panel: PanelBox, anchor: DOMRect, gap: number): boolean {
  const panelRight = panel.left + panel.width;
  const panelBottom = panel.top + panel.height;
  const overlapsX = panel.left < anchor.right + gap && panelRight > anchor.left - gap;
  const overlapsY = panel.top < anchor.bottom + gap && panelBottom > anchor.top - gap;
  return overlapsX && overlapsY;
}

function resolveFloatingPanelPosition(
  x: number,
  y: number,
  panel: PanelBox,
  pad: number,
  anchor?: DOMRect | null,
  anchorGap = 6,
): FloatingPanelPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let nextX = Math.max(pad, Math.min(x, vw - panel.width - pad));
  let nextY = Math.max(pad, Math.min(y, vh - panel.height - pad));

  if (!anchor) return { x: nextX, y: nextY };

  const box = (): PanelBox => ({ left: nextX, top: nextY, width: panel.width, height: panel.height });
  if (!panelOverlapsAnchor(box(), anchor, anchorGap)) {
    return { x: nextX, y: nextY };
  }

  const belowY = anchor.bottom + anchorGap;
  if (belowY + panel.height <= vh - pad) {
    nextY = belowY;
  } else {
    const aboveY = anchor.top - anchorGap - panel.height;
    if (aboveY >= pad) nextY = aboveY;
  }

  const leftX = anchor.left - anchorGap - panel.width;
  if (leftX >= pad) nextX = leftX;

  if (panelOverlapsAnchor(box(), anchor, anchorGap)) {
    nextY = Math.max(pad, Math.min(belowY, vh - panel.height - pad));
  }

  return { x: nextX, y: nextY };
}

export function useFloatingPanelPosition(
  x: number,
  y: number,
  panelRef: RefObject<HTMLElement | null>,
  pad = 8,
  anchorRef?: RefObject<HTMLElement | null>,
) {
  const [finalPos, setFinalPos] = useState<FloatingPanelPosition>({ x, y });
  const [posVisible, setPosVisible] = useState(false);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const anchor = anchorRef?.current?.getBoundingClientRect() ?? null;
    const next = resolveFloatingPanelPosition(
      x,
      y,
      { left: 0, top: 0, width: rect.width, height: rect.height },
      pad,
      anchor,
    );
    setFinalPos(next);
    setPosVisible(true);
  }, [x, y, panelRef, pad, anchorRef]);

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
