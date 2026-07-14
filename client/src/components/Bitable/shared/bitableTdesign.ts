import type { PopupProps } from 'tdesign-react';
import { FLOATING_Z_INDEX } from '../../Editor/shared/floatingPanel';

/** Bitable 浮层内的 TDesign Select / Popup 统一挂到 body，避免被面板裁切或误关。 */
export const BITABLE_TD_SELECT_POPUP_PROPS: PopupProps = {
  attach: () => document.body,
  zIndex: FLOATING_Z_INDEX.bitableMenu,
  overlayClassName: 'bitable-td-select-popup',
};

export const BITABLE_TD_PORTAL_SELECTOR =
  '.t-select__dropdown, .t-popup, .bitable-td-select-popup, .bitable-card-config-select-popup';
