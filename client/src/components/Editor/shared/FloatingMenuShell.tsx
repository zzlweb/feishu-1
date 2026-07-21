import {
  useCallback,
  useMemo,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useOverlayRegistration } from '../../../shared/overlay';
import {
  FLOATING_Z_INDEX,
  bindFloatingLayoutListeners,
  useAnchoredContextMenuPosition,
  useHoverFloatingGroup,
  type FloatingPanelPosition,
} from './floatingPanel';

/** 飞书块配置菜单及其子飞出层 — 命中检测统一选择器 */
export const CONTEXT_MENU_SHELL_SELECTORS = [
  '.context-menu',
  '.context-submenu-flyout',
  '.context-add-below-flyout',
  '.slash-table-grid-flyout',
  '.slash-columns-count-flyout',
  '.docx-menu-wrapper',
  '.bitable-context-menu',
  '.feishu-table-chrome',
  '[data-floating-panel="true"]',
] as const;

export const CONTEXT_MENU_HOVER_DELAY_MS = 160;

export function floatingMenuPanelStyle(
  pos: FloatingPanelPosition,
  visible: boolean,
  zIndex: number = FLOATING_Z_INDEX.docMenu,
): CSSProperties {
  return {
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    zIndex,
    visibility: visible ? 'visible' : 'hidden',
  };
}

export function FloatingMenuPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export interface UseFloatingMenuShellOptions {
  fallback: FloatingPanelPosition;
  panelRef: RefObject<HTMLElement | null>;
  anchorRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onHoverDismiss?: () => void;
  onMouseEnterCancel?: () => void;
  /** 额外参与悬停保活的节点（flyout trigger / panel） */
  hoverRefs?: Array<RefObject<HTMLElement | null> | undefined>;
  hoverSelectors?: string[];
  closeDelay?: number;
  zIndex?: number;
  computePosition?: (
    anchor: DOMRect,
    menuW: number,
    menuH: number,
  ) => FloatingPanelPosition;
  /** 点击外部关闭时，额外视为「菜单内」的选择器 */
  insideSelectors?: string[];
}

/**
 * 块/媒体/表格/多维表配置菜单共用的壳：锚定定位、body portal 样式、悬停关闭、Esc/外点关闭。
 * 子菜单 flyout 仍由各菜单自行渲染，但布局同步应走 bindFloatingLayoutListeners。
 */
export function useFloatingMenuShell({
  fallback,
  panelRef,
  anchorRef,
  onClose,
  onHoverDismiss,
  onMouseEnterCancel,
  hoverRefs = [],
  hoverSelectors = [...CONTEXT_MENU_SHELL_SELECTORS],
  closeDelay = CONTEXT_MENU_HOVER_DELAY_MS,
  zIndex = FLOATING_Z_INDEX.docMenu,
  computePosition,
  insideSelectors = [...CONTEXT_MENU_SHELL_SELECTORS],
}: UseFloatingMenuShellOptions) {
  const { finalPos, posVisible } = useAnchoredContextMenuPosition(
    anchorRef,
    panelRef,
    fallback,
    computePosition,
  );

  const dismissByHover = () => {
    (onHoverDismiss ?? onClose)();
  };

  const hoverGroup = useHoverFloatingGroup({
    refs: [panelRef, anchorRef, ...hoverRefs],
    selectors: hoverSelectors,
    closeDelay,
    onClose: dismissByHover,
  });

  const isInsideShell = useCallback((target: Node) => {
    if (panelRef.current?.contains(target) || anchorRef?.current?.contains(target)) return true;
    if (!(target instanceof Element)) return false;
    return insideSelectors.some(selector => Boolean(target.closest(selector)));
  }, [anchorRef, insideSelectors, panelRef]);

  useOverlayRegistration({
    open: true,
    onClose,
    contains: isInsideShell,
    restoreFocusRef: anchorRef,
  });

  const panelStyle = useMemo(
    () => floatingMenuPanelStyle(finalPos, posVisible, zIndex),
    [finalPos.x, finalPos.y, posVisible, zIndex],
  );

  const keepHoverAlive = () => {
    hoverGroup.cancelClose();
    onMouseEnterCancel?.();
  };

  return {
    finalPos,
    posVisible,
    panelStyle,
    keepHoverAlive,
    scheduleClose: hoverGroup.scheduleClose,
    cancelClose: hoverGroup.cancelClose,
    containsTarget: hoverGroup.containsTarget,
    getHoverProps: hoverGroup.getHoverProps,
  };
}

/** 子飞出层随主菜单/滚动重定位 */
export function bindMenuFlyoutReposition(
  sync: () => void,
  anchor?: HTMLElement | null,
) {
  return bindFloatingLayoutListeners(sync, anchor);
}
