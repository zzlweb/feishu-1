import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type MutableRefObject,
  type Ref,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import * as React from 'react';
import { SelGlyphChevronDown } from '../../../icons/selectionToolbarGlyphs';
import { FieldLockGlyph, fieldTypeGlyph } from '../fields/bitableFieldTypeIcons';
import { getAttachments, getMultiSelectChoices, valueText, findSelectChoice, formatCardDateValue, normalizeColorValue, textColorForBackground, type AttachmentValue, type BaseField, type BaseRecord, type CellValue } from '../model/bitableModel';
import { FLOATING_Z_INDEX, bindFloatingLayoutListeners } from '../../Editor/shared/floatingPanel';
import { BITABLE_TD_PORTAL_SELECTOR } from './bitableTdesign';

export { FieldLockGlyph, fieldTypeGlyph };

type GlyphProps = { size?: number };

function svgProps(size: number) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' } as const;
}

function GridMenuGlyph({ children }: { children: React.ReactNode }) {
  return <span className="base-grid-field-menu__icon" aria-hidden>{children}</span>;
}

const GridMenuGlyphEdit = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M14.5 4.5 19 9l-9.5 9.5H5v-4.5L14.5 4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12.5 6.5l3 3" stroke="currentColor" strokeWidth="1.5" /></svg>
);

const GridMenuGlyphInfo = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" /><path d="M12 10v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);

const GridMenuGlyphCopy = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><rect x="8" y="8" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.5" /></svg>
);

const GridMenuGlyphHide = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M3 8.5c2.2 3.3 5.2 5 9 5s6.8-1.7 9-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="m5 12 2.5-2.5M10 13.5l.8-3M14 13.5l-.8-3M19 12l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);

const GridMenuGlyphInsertLeft = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M19 12H8M11 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const GridMenuGlyphInsertRight = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M5 12h11M13 8l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const GridMenuGlyphSortAsc = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M8 16V8l-3 3M16 8v8M13 11l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const GridMenuGlyphSortDesc = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M8 8v8l-3-3M16 16V8M13 13l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const GridMenuGlyphGroup = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><rect x="4" y="5" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="5" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="4" y="13" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="13" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>
);

const GridMenuGlyphFilter = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);

const GridMenuGlyphDelete = ({ size = 16 }: GlyphProps) => (
  <svg {...svgProps(size)}><path d="M5 7h14M10 11v6M14 11v6M8 7l.5-2h7l.5 2M7 7l1 13h8l1-13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const GRID_FIELD_MENU_ICONS = {
  rename: GridMenuGlyphEdit,
  description: GridMenuGlyphInfo,
  duplicate: GridMenuGlyphCopy,
  hide: GridMenuGlyphHide,
  insertLeft: GridMenuGlyphInsertLeft,
  insertRight: GridMenuGlyphInsertRight,
  sortAsc: GridMenuGlyphSortAsc,
  sortDesc: GridMenuGlyphSortDesc,
  group: GridMenuGlyphGroup,
  filter: GridMenuGlyphFilter,
  delete: GridMenuGlyphDelete,
} as const;

export function GridFieldMenuIcon({ name }: { name: keyof typeof GRID_FIELD_MENU_ICONS }) {
  const Icon = GRID_FIELD_MENU_ICONS[name];
  return (
    <GridMenuGlyph>
      <Icon size={16} />
    </GridMenuGlyph>
  );
}

export function FieldDisplay({ field, value }: { field: BaseField; value: CellValue }) {
  const text = valueText(value);
  if (field.type === 'checkbox') {
    return <span className={`base-checkbox-value${value ? ' is-checked' : ''}`} aria-label={value ? '已勾选' : '未勾选'} />;
  }
  if (field.name === '进度' || (field.type === 'text' && /^\d+(\.\d+)?%$/.test(text))) {
    const percent = Math.min(100, Math.max(0, Number.parseFloat(text.replace('%', '')) || 0));
    return (
      <div className="base-field-progress">
        <div className="base-field-progress__track">
          <div className="base-field-progress__fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="base-field-progress__label">{text}</span>
      </div>
    );
  }
  if (field.type === 'single_select') {
    if (!text) return null;
    const choice = findSelectChoice(field, text);
    if (!choice) return <span className="base-cell-tag">{text}</span>;
    const color = normalizeColorValue(choice.color);
    return (
      <span
        className="base-cell-tag is-colored"
        style={{ backgroundColor: color, color: textColorForBackground(color) }}
      >
        {choice.name}
      </span>
    );
  }
  if (field.type === 'multi_select') {
    const choices = getMultiSelectChoices(field, value);
    if (!choices.length) return null;
    return (
      <span className="base-cell-tag-list">
        {choices.map(choice => {
          const color = normalizeColorValue(choice.color);
          return (
            <span
              key={choice.id}
              className="base-cell-tag is-colored"
              style={{ backgroundColor: color, color: textColorForBackground(color) }}
            >
              {choice.name}
            </span>
          );
        })}
      </span>
    );
  }
  if (field.type === 'date') {
    const formatted = formatCardDateValue(value);
    if (!formatted) return null;
    return <span>{formatted}</span>;
  }
  if (field.type === 'number' && typeof value === 'number') {
    return <span>{value.toLocaleString('zh-CN')}</span>;
  }
  if (!text) return null;
  if (field.type === 'attachment') return <span>{(value as AttachmentValue[]).length} 个附件</span>;
  if (field.type === 'url') {
    const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    return <a className="base-field-link" href={href} target="_blank" rel="noopener noreferrer">{text}</a>;
  }
  if (field.type === 'email') return <a className="base-field-link" href={`mailto:${text}`}>{text}</a>;
  if (field.type === 'phone') return <a className="base-field-link" href={`tel:${text}`}>{text}</a>;
  if (field.type === 'user' || field.type === 'created_by' || field.type === 'updated_by') {
    return (
      <span className="base-field-user">
        <span className="base-field-user__avatar" aria-hidden>{text.charAt(0)}</span>
        <span>{text}</span>
      </span>
    );
  }
  if (field.type === 'created_time' || field.type === 'updated_time') {
    const formatted = formatCardDateValue(value);
    return formatted ? <span>{formatted}</span> : null;
  }
  return <span>{text}</span>;
}

export function fieldCardIcon(field: BaseField): string {
  if (field.type === 'checkbox') return '☑';
  if (field.type === 'date') return '▣';
  if (field.type === 'number') return '#';
  if (field.type === 'formula') return 'ƒx';
  if (field.type === 'single_select') return '⊙';
  if (field.type === 'multi_select') return '☷';
  if (field.type === 'attachment') return '▧';
  if (field.type === 'user' || field.type === 'created_by' || field.type === 'updated_by') return '👤';
  if (field.type === 'url') return '↗';
  if (field.type === 'phone') return '☎';
  if (field.type === 'email') return '@';
  return 'A=';
}

export function getAttachmentMediaUrl(attachment: AttachmentValue | undefined): string {
  if (!attachment) return '';
  return attachment.thumbnailUrl || attachment.previewUrl || attachment.url || '';
}

export function isPreviewImage(attachment: AttachmentValue | undefined) {
  return Boolean(attachment?.mimeType.startsWith('image/') && getAttachmentMediaUrl(attachment));
}

export function isPreviewVideo(attachment: AttachmentValue | undefined) {
  return Boolean(attachment?.mimeType.startsWith('video/') && (attachment.url || attachment.previewUrl));
}

export function FileBadge({ attachment }: { attachment: AttachmentValue }) {
  const kind = attachment.mimeType.startsWith('video/') ? 'VIDEO' : attachment.extension.toUpperCase() || 'FILE';
  return (
    <div className="base-gallery-file-fallback">
      <strong>{kind}</strong>
      <span>{attachment.name}</span>
    </div>
  );
}

/** 画册/看板封面：图片用 img，视频用 video（preload metadata 显示首帧），其它走 FileBadge。 */
export function AttachmentCoverMedia({
  attachment,
  objectFit,
  objectPosition,
}: {
  attachment: AttachmentValue;
  objectFit?: CSSProperties['objectFit'];
  objectPosition?: string;
}) {
  const mediaStyle = { objectFit, objectPosition } as const;
  if (isPreviewImage(attachment)) {
    return (
      <img
        loading="lazy"
        src={getAttachmentMediaUrl(attachment)}
        alt=""
        style={mediaStyle}
      />
    );
  }
  if (isPreviewVideo(attachment)) {
    const src = attachment.url || attachment.previewUrl || '';
    return (
      <video
        className="base-gallery-cover-video"
        src={src}
        preload="metadata"
        muted
        playsInline
        controls={false}
        style={mediaStyle}
      />
    );
  }
  return <FileBadge attachment={attachment} />;
}

/** 将 Bitable 左缘与标题区对齐：补偿 editor-container 左侧 padding */
export function syncBitableDocAlign(block: HTMLElement) {
  const editorContainer = block.closest<HTMLElement>('.editor-container');
  const paddingLeft = editorContainer
    ? Number.parseFloat(getComputedStyle(editorContainer).paddingLeft) || 0
    : 0;
  block.style.setProperty('--bitable-doc-align-shift', `${paddingLeft}px`);
}

const PRIMARY_FIELD_LOCK_TIP = '索引列：用来标识每条记录。不能被删除、移动或隐藏';

export type BitableTooltipPlacement = 'top' | 'bottom';

function mergeRefs<T>(...refs: Array<Ref<T> | undefined | null>) {
  return (node: T | null) => {
    refs.forEach(ref => {
      if (!ref) return;
      if (typeof ref === 'function') ref(node);
      else (ref as MutableRefObject<T | null>).current = node;
    });
  };
}

function mergeHandlers<E>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
) {
  return (event: E) => {
    theirs?.(event);
    ours(event);
  };
}

export function useBitablePortalTooltip<T extends HTMLElement = HTMLElement>(defaultPlacement: BitableTooltipPlacement = 'top') {
  const anchorRef = useRef<T | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; placement: BitableTooltipPlacement } | null>(null);

  const showTip = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      left: rect.left + rect.width / 2,
      top: defaultPlacement === 'bottom' ? rect.bottom : rect.top,
      placement: defaultPlacement,
    });
  }, [defaultPlacement]);

  const hideTip = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return undefined;
    // 滚动时隐藏；不能立即执行，否则刚显示就会被关掉
    return bindFloatingLayoutListeners(hideTip, anchorRef.current, { runImmediately: false });
  }, [hideTip, pos]);

  const bind = {
    ref: anchorRef,
    onMouseEnter: showTip,
    onMouseLeave: hideTip,
    onFocus: showTip,
    onBlur: hideTip,
  };

  const renderTip = (tip: string, className?: string) => pos && createPortal(
    <div
      className={`bitable-portal-tooltip bitable-portal-tooltip--${pos.placement}${className ? ` ${className}` : ''}`}
      role="tooltip"
      style={{ left: pos.left, top: pos.top }}
    >
      {tip}
    </div>,
    document.body,
  );

  return { bind, renderTip };
}

export function BitableTooltip({
  tip,
  placement = 'top',
  className,
  tipClassName,
  children,
}: {
  tip: string;
  placement?: BitableTooltipPlacement;
  className?: string;
  tipClassName?: string;
  children: React.ReactElement;
}) {
  const { bind, renderTip } = useBitablePortalTooltip(placement);
  const child = React.Children.only(children);
  if (!React.isValidElement(child)) return children;

  const childProps = child.props as {
    className?: string;
    onMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<HTMLElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
    ref?: Ref<HTMLElement>;
  };

  return (
    <>
      {React.cloneElement(child as React.ReactElement<typeof childProps>, {
        ref: mergeRefs(childProps.ref, bind.ref),
        className: [childProps.className, className, 'bitable-tooltip-anchor'].filter(Boolean).join(' '),
        onMouseEnter: mergeHandlers(childProps.onMouseEnter, bind.onMouseEnter),
        onMouseLeave: mergeHandlers(childProps.onMouseLeave, bind.onMouseLeave),
        onFocus: mergeHandlers(childProps.onFocus, bind.onFocus),
        onBlur: mergeHandlers(childProps.onBlur, bind.onBlur),
      })}
      {renderTip(tip, tipClassName)}
    </>
  );
}

function GridFieldLockWithTooltip() {
  const { bind, renderTip } = useBitablePortalTooltip();
  return (
    <>
      <span
        {...bind}
        className="base-grid-field-lock"
        aria-label={PRIMARY_FIELD_LOCK_TIP}
        tabIndex={0}
      >
        <FieldLockGlyph size={14} />
      </span>
      {renderTip(PRIMARY_FIELD_LOCK_TIP)}
    </>
  );
}

export function GridFieldHeader({
  field,
  primaryFieldId,
  isMenuOpen,
  onMenuClick,
  onHeaderContextMenu,
}: {
  field: BaseField;
  primaryFieldId: string;
  isMenuOpen?: boolean;
  onMenuClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onHeaderContextMenu?: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <span
      className="base-grid-field-head"
      onContextMenu={event => {
        event.preventDefault();
        event.stopPropagation();
        onHeaderContextMenu?.(event);
      }}
    >
      {field.id === primaryFieldId && <GridFieldLockWithTooltip />}
      <span className="base-grid-field-icon" aria-hidden>{fieldTypeGlyph(field.type, 16)}</span>
      <span className="base-grid-field-name">{field.name}</span>
      <button
        type="button"
        className={`base-grid-field-chevron${isMenuOpen ? ' is-open' : ''}`}
        data-field-id={field.id}
        aria-label={`${field.name} 字段菜单`}
        aria-expanded={Boolean(isMenuOpen)}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          onMenuClick?.(event);
        }}
        onMouseDown={event => {
          event.stopPropagation();
        }}
      >
        <SelGlyphChevronDown size={14} fill="currentColor" />
      </button>
    </span>
  );
}

export function attachmentCellLabel(record: BaseRecord, fieldId: string) {
  const count = getAttachments(record, fieldId).length;
  return count ? `${count} 个附件` : '+ 添加附件';
}

export const BITABLE_PANEL_PORTAL_SELECTOR =
  `.base-toolbar-panel--portal, .bitable-group-panel--portal, .bitable-sort-panel--portal, .bitable-toolbar__group-menu--portal, .bitable-field-condition-picker__menu--portal, .bitable-group-field-picker__menu--portal, .base-filter-select__menu--portal, .base-field-edit-popover-portal, .base-b-field-type-picker-portal, .base-b-select-color-panel, .base-b-select-default-panel, .base-view-contextmenu--portal, .base-grid-field-menu--portal, .base-grid-cell-menu--portal, ${BITABLE_TD_PORTAL_SELECTOR}`;

export function isBitablePanelPortalTarget(node: EventTarget | null): boolean {
  return node instanceof Element && Boolean(node.closest(BITABLE_PANEL_PORTAL_SELECTOR));
}

/** 工具栏筛选/分组/排序等宽面板：相对锚点水平居中，视口内 clamp */
export function computeBitableToolbarPortalPosition(
  anchor: DOMRect,
  panelWidth: number,
  panelHeight: number,
  pad = 8,
  gap = 6,
) {
  let left = anchor.left + anchor.width / 2 - panelWidth / 2;
  let top = anchor.bottom + gap;
  if (top + panelHeight > window.innerHeight - pad && anchor.top - gap - panelHeight >= pad) {
    top = anchor.top - gap - panelHeight;
  }
  left = Math.max(pad, Math.min(left, window.innerWidth - panelWidth - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - Math.min(panelHeight, window.innerHeight - pad * 2) - pad));
  return { left, top };
}

export function useBitableToolbarPortalStyle(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null> | undefined,
  panelRef: RefObject<HTMLElement | null>,
  fallbackWidth: number,
  fallbackHeight = 320,
): CSSProperties | undefined {
  const [pos, setPos] = useState({ left: 0, top: 0, visible: false });

  useLayoutEffect(() => {
    if (!open || !anchorRef) {
      setPos(prev => (prev.visible ? { left: 0, top: 0, visible: false } : prev));
      return undefined;
    }

    const sync = () => {
      const anchor = anchorRef.current;
      if (!anchor?.isConnected) return;
      const panel = panelRef.current;
      const width = panel?.offsetWidth || fallbackWidth;
      const height = panel?.offsetHeight || fallbackHeight;
      const next = computeBitableToolbarPortalPosition(anchor.getBoundingClientRect(), width, height);
      setPos(prev => (
        prev.left === next.left && prev.top === next.top && prev.visible
          ? prev
          : { left: next.left, top: next.top, visible: true }
      ));
    };

    // 首帧先按 fallback 尺寸定位并立刻可见，避免 visibility:hidden 卡住。
    sync();
    const raf = window.requestAnimationFrame(() => {
      sync();
      if (panelRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObserver?.observe(panelRef.current);
      }
    });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    if (panelRef.current) resizeObserver?.observe(panelRef.current);
    const cleanupLayout = bindFloatingLayoutListeners(sync, anchorRef.current);
    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      cleanupLayout();
    };
  }, [open, anchorRef, panelRef, fallbackWidth, fallbackHeight]);

  if (!open || !anchorRef) return undefined;
  return {
    position: 'fixed',
    left: pos.left,
    top: pos.top,
    zIndex: FLOATING_Z_INDEX.bitablePanel,
    // 即使首帧尚未测到尺寸，也展示；定位会在 layout/raf 中校正。
    visibility: pos.visible || open ? 'visible' : 'hidden',
    maxHeight: 'min(80vh, calc(100vh - 16px))',
  };
}

export function resolveBitableBleedRightEdge(block: HTMLElement, edgeMargin: number): number {
  const pageMain = block.closest<HTMLElement>('.doc-page-main');
  const mainRect = pageMain?.getBoundingClientRect();
  if (mainRect && mainRect.width > 0) {
    return mainRect.right - edgeMargin;
  }

  const docPage = block.closest<HTMLElement>('.doc-page');
  const commentRail = docPage
    ? Number.parseFloat(getComputedStyle(docPage).getPropertyValue('--comment-rail-width')) || 0
    : 0;
  return window.innerWidth - commentRail - edgeMargin;
}

const BITABLE_TOOLBAR_HOVER_KEEP_ALIVE =
  '.base-viewbar__tool-anchor, .bitable-float-toolbar-btn-wrapper, .base-viewbar__tool, .bitable-float-toolbar-btn, .base-toolbar-panel, .bitable-group-panel, .bitable-sort-panel, .bitable-toolbar__group-menu';

function isBitableToolbarHoverKeepAlive(target: EventTarget | null): boolean {
  if (isBitablePanelPortalTarget(target)) return true;
  return target instanceof Element && Boolean(target.closest(BITABLE_TOOLBAR_HOVER_KEEP_ALIVE));
}

/**
 * 工具栏筛选/分组/排序等面板的悬停保活。
 * 打开面板时 React 重渲染会触发「假 mouseleave」（relatedTarget 常为 null），
 * 若直接 onClose 会表现为「点了没反应」。关闭前用 elementFromPoint 复核指针位置。
 */
export function useBitablePanelHoverHandlers(onClose: () => void, enabled = true) {
  const timerRef = useRef<number>();

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const cancelClose = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (!enabled) cancelClose();
  }, [cancelClose, enabled]);

  const scheduleClose = useCallback((event?: MouseEvent<HTMLElement>) => {
    if (!enabled) return;
    cancelClose();
    const clientX = event?.clientX;
    const clientY = event?.clientY;
    timerRef.current = window.setTimeout(() => {
      const related = event?.relatedTarget ?? null;
      if (isBitableToolbarHoverKeepAlive(related)) return;
      // 重渲染假 leave：relatedTarget 为空时，按指针下元素判断是否仍在按钮/面板上。
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        const under = document.elementFromPoint(clientX, clientY);
        if (isBitableToolbarHoverKeepAlive(under)) return;
      } else if (related == null) {
        // 无坐标的假 leave（如节点卸载）一律忽略，交给外点关闭。
        return;
      }
      onClose();
    }, 160);
  }, [cancelClose, enabled, onClose]);

  return {
    onMouseEnter: cancelClose,
    onMouseLeave: scheduleClose,
  };
}
