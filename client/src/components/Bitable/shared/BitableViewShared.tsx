import { useCallback, useEffect, useRef, useState, type MouseEvent, type MutableRefObject, type Ref } from 'react';
import { createPortal } from 'react-dom';
import * as React from 'react';
import { SelGlyphChevronDown } from '../../../icons/selectionToolbarGlyphs';
import { FieldLockGlyph, fieldTypeGlyph } from '../fields/bitableFieldTypeIcons';
import { getAttachments, valueText, findSelectChoice, formatCardDateValue, textColorForBackground, type AttachmentValue, type BaseField, type BaseRecord, type CellValue } from '../model/bitableModel';

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
    const color = choice.color || '#e8f0ff';
    return (
      <span
        className="base-cell-tag is-colored"
        style={{ backgroundColor: color, color: textColorForBackground(color) }}
      >
        {choice.name}
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
  return <span>{text}</span>;
}

export function fieldCardIcon(field: BaseField): string {
  if (field.type === 'checkbox') return '☑';
  if (field.type === 'date') return '▣';
  if (field.type === 'number') return '#';
  if (field.type === 'formula') return 'ƒx';
  if (field.type === 'single_select') return '⊙';
  return 'A=';
}

export function isPreviewImage(attachment: AttachmentValue | undefined) {
  return Boolean(attachment?.mimeType.startsWith('image/') && (attachment.thumbnailUrl || attachment.previewUrl || attachment.url));
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
  '.bitable-field-condition-picker__menu--portal, .bitable-group-field-picker__menu--portal, .base-filter-select__menu--portal, .base-field-edit-popover-portal, .base-b-field-type-picker-portal, .base-b-select-color-panel, .base-b-select-default-panel, .base-view-contextmenu--portal';

export function isBitablePanelPortalTarget(node: EventTarget | null): boolean {
  return node instanceof Element && Boolean(node.closest(BITABLE_PANEL_PORTAL_SELECTOR));
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

  const scheduleClose = useCallback((event?: MouseEvent<HTMLElement>) => {
    if (!enabled) return;
    cancelClose();
    timerRef.current = window.setTimeout(() => {
      const related = event?.relatedTarget ?? null;
      if (isBitablePanelPortalTarget(related)) return;
      onClose();
    }, 120);
  }, [cancelClose, enabled, onClose]);

  return {
    onMouseEnter: cancelClose,
    onMouseLeave: scheduleClose,
  };
}
