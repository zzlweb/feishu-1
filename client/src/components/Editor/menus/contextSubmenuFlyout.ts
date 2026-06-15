export interface SubmenuFlyoutPosition {
  top: number;
  left: number;
}

export interface ComputeSubmenuFlyoutInput {
  trigger: DOMRect;
  panelWidth: number;
  panelHeight: number;
  gap?: number;
  pad?: number;
}

/** 子菜单相对触发项定位：右侧展开，贴底时与触发项底边对齐并限制在视口内 */
export function computeSubmenuFlyoutPosition(input: ComputeSubmenuFlyoutInput): SubmenuFlyoutPosition {
  const pad = input.pad ?? 8;
  const gap = input.gap ?? 0;
  const { trigger, panelWidth, panelHeight } = input;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = trigger.right + gap;
  if (left + panelWidth > vw - pad) {
    left = Math.max(pad, trigger.left - panelWidth - gap);
  }

  let top = trigger.top;
  if (top + panelHeight > vh - pad) {
    const bottomAligned = trigger.bottom - panelHeight;
    top = bottomAligned >= pad ? bottomAligned : Math.max(pad, vh - pad - panelHeight);
  }
  if (top < pad) top = pad;

  return { top, left };
}

export const ADD_BELOW_FLYOUT_MAX_HEIGHT = 646;
export const COLOR_FLYOUT_WIDTH = 252;
/** 颜色面板实际内容高度约 220–240px；勿用 max-height(420) 参与定位，否则会错误触发底对齐 */
export const COLOR_FLYOUT_ESTIMATED_HEIGHT = 236;

export function clampFlyoutHeight(measured: number, pad = 8): number {
  return Math.min(ADD_BELOW_FLYOUT_MAX_HEIGHT, measured, window.innerHeight - 2 * pad);
}
